import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_submit_text_single_word_creates_flashcard(
    client: TestClient, auth_headers: dict[str, str]
):
    response = client.post(
        "/api/v1/words/submit-text",
        headers=auth_headers,
        json={
            "text": "sonder - осознание",
            "source_lang": "ru",
            "target_lang": "en",
            "wait": True,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "completed"
    assert data["is_lesson"] is False
    assert data["is_multi_sentence"] is False
    assert data["can_create_lesson"] is False
    assert data["lesson"] is None
    assert len(data["words"]) >= 1

    word = data["words"][0]
    assert word["text"] in ["sonder", "realization"]
    assert word["language_code"] == "en"
    assert word["pos"] is not None
    assert word["phonetic"] is not None
    assert word["context_phrase"] is not None


def test_submit_text_five_or_more_words_creates_in_progress_lesson_without_words_until_prepare(
    client: TestClient, auth_headers: dict[str, str]
):
    multi_text = "The dog barked loudly. The cat ran away into the house!"
    response = client.post(
        "/api/v1/words/submit-text",
        headers=auth_headers,
        json={
            "text": multi_text,
            "source_lang": "ru",
            "target_lang": "en",
            "wait": True,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "completed"
    assert data["is_lesson"] is True
    assert data["can_create_lesson"] is True
    assert data["lesson_in_progress"] is True
    assert data["lesson"] is not None
    assert data["lesson"]["status"] in ["processing", "ready"]
    # Words must NOT be added to wordlist on initial text submission for lesson-eligible text
    assert len(data["words"]) == 0

    lesson_id = data["lesson"]["id"]

    # Verify user's wordlist is empty before text review selection
    wordlist_res = client.get("/api/v1/words/", headers=auth_headers)
    assert wordlist_res.status_code == 200
    assert len(wordlist_res.json()) == 0

    # User reviews text and clicks Continue with selected words in prepare endpoint
    prepare_res = client.post(
        f"/api/v1/lessons/{lesson_id}/prepare",
        headers=auth_headers,
        json={
            "selected_words": ["barked"],
            "source_lang": "ru",
            "target_lang": "en",
        },
    )
    assert prepare_res.status_code == 200
    prepare_data = prepare_res.json()
    assert len(prepare_data["words"]) == 1
    assert prepare_data["words"][0]["text"] == "barked"

    # Now, ONLY the selected word appears in the user's wordlist
    wordlist_after_res = client.get("/api/v1/words/", headers=auth_headers)
    assert wordlist_after_res.status_code == 200
    after_words = wordlist_after_res.json()
    assert len(after_words) == 1
    assert after_words[0]["text"] == "barked"

    # Under 5 words does NOT create a lesson, extracts words directly
    short_text = "The dog barked loudly"  # 4 words
    short_res = client.post(
        "/api/v1/words/submit-text",
        headers=auth_headers,
        json={
            "text": short_text,
            "source_lang": "ru",
            "target_lang": "en",
            "wait": True,
        },
    )
    assert short_res.status_code == 201
    short_data = short_res.json()
    assert short_data["is_lesson"] is False
    assert short_data["lesson"] is None
    assert len(short_data["words"]) >= 1


def test_jobs_submit_and_status_endpoints(
    client: TestClient, auth_headers: dict[str, str]
):
    # Submit job
    submit_res = client.post(
        "/api/v1/jobs/submit",
        headers=auth_headers,
        json={
            "text": "apple - яблоко",
            "source_lang": "ru",
            "target_lang": "en",
            "wait": True,
        },
    )
    assert submit_res.status_code == 202
    submit_data = submit_res.json()
    job_id = submit_data["job_id"]
    assert job_id is not None
    assert submit_data["status"] == "completed"

    # Query job status
    job_res = client.get(f"/api/v1/jobs/{job_id}", headers=auth_headers)
    assert job_res.status_code == 200
    job_data = job_res.json()
    assert job_data["id"] == job_id
    assert job_data["status"] == "completed"
    assert job_data["input_text"] == "apple - яблоко"


def test_lessons_generate_quiz_and_complete_endpoints(
    client: TestClient, auth_headers: dict[str, str]
):
    # 1. Generate quiz directly from multi-sentence text
    text_input = "Hello world! We are reading a book."
    quiz_res = client.post(
        "/api/v1/lessons/generate-quiz",
        headers=auth_headers,
        json={
            "text": text_input,
            "title": "World & Book Quiz",
            "source_lang": "ru",
            "target_lang": "en",
        },
    )
    assert quiz_res.status_code == 201
    quiz_data = quiz_res.json()
    lesson_id = quiz_data["id"]
    assert quiz_data["title"] == "World & Book Quiz"
    assert quiz_data["input_type"] == "quiz"
    assert quiz_data["is_completed"] is False
    assert len(quiz_data["words"]) > 0
    assert quiz_data["quiz_data"] is not None

    questions = quiz_data["quiz_data"].get("questions", [])
    assert len(questions) > 0
    first_q = questions[0]
    assert "question" in first_q
    assert len(first_q["options"]) == 4
    assert 0 <= first_q["correct_index"] < 4
    assert "explanation" in first_q

    # 2. List lessons
    list_res = client.get("/api/v1/lessons/", headers=auth_headers)
    assert list_res.status_code == 200
    lessons = list_res.json()
    assert len(lessons) >= 1
    matching = next((l for l in lessons if l["id"] == lesson_id), None)
    assert matching is not None
    assert matching["quiz_data"] is not None

    # 3. Get single lesson
    get_res = client.get(f"/api/v1/lessons/{lesson_id}", headers=auth_headers)
    assert get_res.status_code == 200
    single_lesson = get_res.json()
    assert single_lesson["id"] == lesson_id
    assert single_lesson["is_completed"] is False

    # 4. Complete lesson
    complete_res = client.post(
        f"/api/v1/lessons/{lesson_id}/complete",
        headers=auth_headers,
        json={"is_completed": True, "score": 2, "total": 2},
    )
    assert complete_res.status_code == 200
    completed_lesson = complete_res.json()
    assert completed_lesson["is_completed"] is True
    assert completed_lesson["status"] == "completed"


def test_lessons_generate_quiz_from_word_ids(
    client: TestClient, auth_headers: dict[str, str]
):
    # Add two words
    w1_res = client.post(
        "/api/v1/words/",
        headers=auth_headers,
        json={"text": "banana", "translation": "банан", "language_code": "en"},
    )
    w2_res = client.post(
        "/api/v1/words/",
        headers=auth_headers,
        json={"text": "sun", "translation": "солнце", "language_code": "en"},
    )
    assert w1_res.status_code == 201
    assert w2_res.status_code == 201
    w1_id = w1_res.json()["id"]
    w2_id = w2_res.json()["id"]

    # Generate quiz for word IDs
    quiz_res = client.post(
        "/api/v1/lessons/generate-quiz",
        headers=auth_headers,
        json={
            "word_ids": [w1_id, w2_id],
            "title": "Fruit and Nature Quiz",
            "source_lang": "ru",
            "target_lang": "en",
        },
    )
    assert quiz_res.status_code == 201
    data = quiz_res.json()
    assert data["title"] == "Fruit and Nature Quiz"
    assert len(data["words"]) == 2
    assert data["quiz_data"] is not None
    assert len(data["quiz_data"]["questions"]) == 2

