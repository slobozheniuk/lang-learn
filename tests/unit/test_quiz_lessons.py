import json
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.security import hash_password, create_access_token
from app.crud.lesson import create_lesson, get_lesson_by_id
from app.crud.stats import get_or_create_user_word_stats
from app.crud.user import create_user
from app.crud.word import get_or_create_word
from app.models.lesson import Lesson
from app.models.user import User
from app.models.user_word_stats import UserWordStats
from app.models.word import Word
from app.schemas.lesson import LessonCreate, LessonRead, QuizQuestion, QuizData
from app.schemas.user import UserCreate
from app.services.job_queue import count_sentences, JobQueueService
from app.services.llm.mock_provider import MockLLMProvider
from app.services.llm.openai_provider import OpenAILikeProvider
from app.services.scheduler import (
    check_and_generate_revision_quiz_for_user,
    check_and_generate_revision_quizzes,
    run_nightly_revision_check,
)


def test_sentence_counter_splitting():
    """Test splitting sentences by ., !, ? and counting."""
    assert count_sentences("Hello world.") == 1
    assert count_sentences("Hello! How are you?") == 2
    assert count_sentences("One sentence! Second sentence. Third sentence?") == 3
    assert count_sentences("Single sentence without punctuation") == 1
    assert count_sentences("") == 0
    assert count_sentences("   \n\n  ") == 0
    assert count_sentences("First.\nSecond.\nThird.") == 3


@pytest.mark.asyncio
async def test_mock_llm_generate_quiz_questions():
    """Test generate_quiz_questions on MockLLMProvider."""
    provider = MockLLMProvider()
    words = [
        {"text": "apple", "translation": "яблоко", "pos": "noun", "context_phrase": "I ate an apple."},
        {"text": "book", "translation": "книга", "pos": "noun", "context_phrase": "She reads a book."},
    ]
    res = await provider.generate_quiz_questions(words, native_lang="ru", target_lang="en")

    assert res.title is not None
    assert len(res.questions) == 2
    for q in res.questions:
        assert isinstance(q.question, str)
        assert len(q.options) == 4
        assert 0 <= q.correct_index < len(q.options)
        assert q.explanation is not None


@pytest.mark.asyncio
async def test_openai_like_provider_generate_quiz_questions(monkeypatch):
    """Test generate_quiz_questions parsing and formatting on OpenAILikeProvider."""
    provider = OpenAILikeProvider(api_key="test-key")

    mock_quiz_json = json.dumps({
        "title": "Fruits & Books Quiz",
        "questions": [
            {
                "question": "What does 'apple' mean?",
                "options": ["яблоко", "книга", "дом", "собака"],
                "correct_index": 0,
                "explanation": "'apple' translates to 'яблоко'."
            },
            {
                "question": "What does 'book' mean?",
                "options": ["дом", "книга", "солнце", "мир"],
                "correct_index": 1,
                "explanation": "'book' translates to 'книга'."
            }
        ]
    })

    async def mock_generate_quiz(words, source_lang, target_lang, text=None, title=None):
        return provider._parse_and_validate_quiz(mock_quiz_json)

    monkeypatch.setattr(provider, "generate_quiz", mock_generate_quiz)

    words = [
        {"text": "apple", "translation": "яблоко"},
        {"text": "book", "translation": "книга"},
    ]
    res = await provider.generate_quiz_questions(words, native_lang="ru", target_lang="en")

    assert res.title == "Fruits & Books Quiz"
    assert len(res.questions) == 2
    assert res.questions[0].correct_index == 0
    assert res.questions[0].options[0] == "яблоко"
    assert res.questions[1].correct_index == 1
    assert res.questions[1].options[1] == "книга"


def test_lesson_model_quiz_data_column(db_session: Session):
    """Test Lesson table quiz_data column and schema parsing."""
    user = create_user(
        db_session,
        UserCreate(username="quiz_user", password="password123"),
        hashed_password=hash_password("password123"),
    )
    quiz_payload = {
        "title": "Sample Quiz",
        "questions": [
            {
                "question": "Choose the translation for 'house':",
                "options": ["дом", "кот", "лес", "вода"],
                "correct_index": 0,
                "explanation": "'house' means 'дом'."
            }
        ]
    }

    lesson_in = LessonCreate(
        source_lang="ru",
        target_lang="en",
        title="Sample Quiz Lesson",
        raw_input="house",
        input_type="quiz",
        quiz_data=quiz_payload,
        is_completed=False,
    )
    lesson = create_lesson(db_session, user_id=user.id, lesson_in=lesson_in, status="ready")

    assert lesson.id is not None
    assert lesson.input_type == "quiz"
    assert lesson.quiz_data is not None

    # Verify JSON deserialization via LessonRead schema
    lesson_read = LessonRead.model_validate(lesson)
    assert isinstance(lesson_read.quiz_data, dict)
    assert lesson_read.quiz_data["title"] == "Sample Quiz"
    assert len(lesson_read.quiz_data["questions"]) == 1


@pytest.mark.asyncio
async def test_job_queue_disables_auto_lesson(db_session: Session):
    """Verify job_queue.py does not create lessons automatically and only stores words."""
    user = create_user(
        db_session,
        UserCreate(username="no_auto_lesson", password="password123"),
        hashed_password=hash_password("password123"),
    )

    mock_llm = MockLLMProvider()
    jq = JobQueueService(llm_provider=mock_llm, session_factory=lambda: db_session)

    job, lesson, words = await jq.submit_text(
        db=db_session,
        user_id=user.id,
        text="apple - яблоко",
        source_lang="ru",
        target_lang="en",
        wait=True,
    )

    assert lesson is None
    assert job.status == "completed"
    assert len(words) >= 1
    # Check that no lesson was saved in DB
    user_lessons = db_session.query(Lesson).filter_by(user_id=user.id).all()
    assert len(user_lessons) == 0


def test_submit_text_sentence_count_and_multi_sentence_flag(client: TestClient, db_session: Session):
    """Test submit-text endpoint returns sentence_count and is_multi_sentence correctly."""
    user = create_user(
        db_session,
        UserCreate(username="sentence_test", password="password123"),
        hashed_password=hash_password("password123"),
    )

    token = create_access_token(data={"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Single sentence
    resp1 = client.post(
        "/api/v1/words/submit-text",
        headers=headers,
        json={"text": "Hello world.", "source_lang": "ru", "target_lang": "en"},
    )
    assert resp1.status_code == 201
    data1 = resp1.json()
    assert data1["is_multi_sentence"] is False
    assert data1["sentence_count"] == 1
    assert data1["is_lesson"] is False

    # 2. Multi-sentence (> 1 sentences)
    resp2 = client.post(
        "/api/v1/words/submit-text",
        headers=headers,
        json={"text": "First sentence. Second sentence! Third sentence?", "source_lang": "ru", "target_lang": "en"},
    )
    assert resp2.status_code == 201
    data2 = resp2.json()
    assert data2["is_multi_sentence"] is True
    assert data2["sentence_count"] == 3
    assert data2["can_create_lesson"] is True


def test_generate_quiz_endpoint(client: TestClient, db_session: Session):
    """Test POST /api/v1/lessons/generate-quiz with word_ids and with raw text."""
    user = create_user(
        db_session,
        UserCreate(username="quiz_api_user", password="password123"),
        hashed_password=hash_password("password123"),
    )

    w1 = get_or_create_word(db_session, language_code="en", text="sun", translation="солнце")
    w2 = get_or_create_word(db_session, language_code="en", text="moon", translation="луна")

    token = create_access_token(data={"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Generate quiz by word_ids
    resp = client.post(
        "/api/v1/lessons/generate-quiz",
        headers=headers,
        json={"word_ids": [w1.id, w2.id], "source_lang": "ru", "target_lang": "en", "title": "Celestial Quiz"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Celestial Quiz"
    assert data["input_type"] == "quiz"
    assert data["quiz_data"] is not None
    assert len(data["words"]) == 2

    # 2. Generate quiz by text
    resp_text = client.post(
        "/api/v1/lessons/generate-quiz",
        headers=headers,
        json={"text": "apple - яблоко\nbook - книга", "source_lang": "ru", "target_lang": "en"},
    )
    assert resp_text.status_code == 201
    data_text = resp_text.json()
    assert data_text["quiz_data"] is not None
    assert len(data_text["words"]) >= 1


def test_chunk_text_and_prepare_lesson_endpoints(client: TestClient, db_session: Session):
    """Test POST /api/v1/lessons/chunk-text and POST /api/v1/lessons/prepare."""
    user = create_user(
        db_session,
        UserCreate(username="chunk_user", password="password123"),
        hashed_password=hash_password("password123"),
    )
    token = create_access_token(data={"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Chunk text endpoint (e.g. testing idiom 'get off' chunked as single entity)
    text = "Please get off the bus and seek enlightenment."
    chunk_resp = client.post(
        "/api/v1/lessons/chunk-text",
        headers=headers,
        json={"text": text, "source_lang": "ru", "target_lang": "en"},
    )
    assert chunk_resp.status_code == 200
    chunk_data = chunk_resp.json()
    assert "chunks" in chunk_data
    chunks = chunk_data["chunks"]
    selectable_texts = [c["text"] for c in chunks if c["is_selectable"]]
    assert "get off" in selectable_texts
    assert "enlightenment" in selectable_texts

    # 2. Prepare lesson with selected unknown words
    prep_resp = client.post(
        "/api/v1/lessons/prepare",
        headers=headers,
        json={
            "text": text,
            "selected_words": ["get off", "enlightenment"],
            "source_lang": "ru",
            "target_lang": "en",
            "title": "Bus Lesson",
        },
    )
    assert prep_resp.status_code == 201
    prep_data = prep_resp.json()
    assert prep_data["title"] == "Bus Lesson"
    assert len(prep_data["words"]) == 2
    word_texts = [w["text"] for w in prep_data["words"]]
    assert "get off" in word_texts
    assert "enlightenment" in word_texts
    assert prep_data["quiz_data"] is not None


@pytest.mark.asyncio
async def test_scheduler_nightly_revision_check(db_session: Session):
    """Test nightly revision check generates a revision quiz only when conditions are met."""
    user = create_user(
        db_session,
        UserCreate(username="sched_user", password="password123"),
        hashed_password=hash_password("password123"),
    )

    w1 = get_or_create_word(db_session, language_code="en", text="house", translation="дом")
    w2 = get_or_create_word(db_session, language_code="en", text="dog", translation="собака")

    now = datetime(2026, 8, 29, 12, 0, 0, tzinfo=timezone.utc)
    mock_llm = MockLLMProvider()

    # Condition 3 not met: No SM-2 due words yet
    lesson = await check_and_generate_revision_quiz_for_user(db_session, user, llm_provider=mock_llm, now=now)
    assert lesson is None

    # Add due words in SM-2
    stats1 = get_or_create_user_word_stats(db_session, user_id=user.id, word_id=w1.id)
    stats1.next_review_at = now - timedelta(hours=2)
    stats2 = get_or_create_user_word_stats(db_session, user_id=user.id, word_id=w2.id)
    stats2.next_review_at = now - timedelta(hours=1)
    db_session.commit()

    # Condition 1 & 2 met (no lessons yet, >24h since any, due words exist)
    rev_lesson = await check_and_generate_revision_quiz_for_user(db_session, user, llm_provider=mock_llm, now=now)
    assert rev_lesson is not None
    assert rev_lesson.input_type == "revision"
    assert rev_lesson.quiz_data is not None

    # Now if user has a recent lesson created within 24h:
    lesson_recent = await check_and_generate_revision_quiz_for_user(db_session, user, llm_provider=mock_llm, now=now + timedelta(hours=1))
    assert lesson_recent is None  # Skipped because rev_lesson was created 1h ago


@pytest.mark.asyncio
async def test_check_and_generate_revision_quizzes_function(db_session: Session):
    """Test check_and_generate_revision_quizzes function for all users."""
    user = create_user(
        db_session,
        UserCreate(username="rev_quizzes_user", password="password123"),
        hashed_password=hash_password("password123"),
    )
    w = get_or_create_word(db_session, language_code="en", text="sun", translation="солнце")
    now = datetime(2026, 8, 29, 12, 0, 0, tzinfo=timezone.utc)
    stats = get_or_create_user_word_stats(db_session, user_id=user.id, word_id=w.id)
    stats.next_review_at = now - timedelta(hours=5)
    db_session.commit()

    mock_llm = MockLLMProvider()
    lessons = await check_and_generate_revision_quizzes(db=db_session, llm_provider=mock_llm, now=now)
    assert len(lessons) >= 1
    assert lessons[0].input_type == "revision"
    assert lessons[0].quiz_data is not None


def test_multi_user_lesson_isolation(client: TestClient, db_session: Session):
    """Verify that User B cannot see, access, or complete User A's lessons."""
    from app.models.learning_profile import LearningProfile

    user_a = create_user(
        db_session,
        UserCreate(username="lesson_user_a", password="password123"),
        hashed_password=hash_password("password123"),
    )
    profile_a = LearningProfile(
        user_id=user_a.id,
        source_language="ru",
        target_language="en",
        is_active=True,
    )
    db_session.add(profile_a)

    user_b = create_user(
        db_session,
        UserCreate(username="lesson_user_b", password="password123"),
        hashed_password=hash_password("password123"),
    )
    profile_b = LearningProfile(
        user_id=user_b.id,
        source_language="ru",
        target_language="en",
        is_active=True,
    )
    db_session.add(profile_b)
    db_session.commit()

    token_a = create_access_token(data={"sub": str(user_a.id), "username": user_a.username})
    headers_a = {"Authorization": f"Bearer {token_a}"}

    token_b = create_access_token(data={"sub": str(user_b.id), "username": user_b.username})
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates a lesson
    lesson_in = LessonCreate(
        source_lang="ru",
        target_lang="en",
        title="User A's Secret Lesson",
        raw_input="Secret phrase",
        input_type="text",
        is_completed=False,
    )
    lesson_a = create_lesson(db_session, user_id=user_a.id, lesson_in=lesson_in, status="ready")

    # User A lists lessons -> sees 1 lesson
    res_a = client.get("/api/v1/lessons/", headers=headers_a)
    assert res_a.status_code == 200
    assert len(res_a.json()) == 1
    assert res_a.json()[0]["id"] == lesson_a.id

    # User B lists lessons -> sees 0 lessons
    res_b = client.get("/api/v1/lessons/", headers=headers_b)
    assert res_b.status_code == 200
    assert len(res_b.json()) == 0

    # User B tries to get User A's lesson by ID -> 404
    res_b_get = client.get(f"/api/v1/lessons/{lesson_a.id}", headers=headers_b)
    assert res_b_get.status_code == 404

    # User B tries to complete User A's lesson -> 404
    res_b_complete = client.post(f"/api/v1/lessons/{lesson_a.id}/complete", headers=headers_b)
    assert res_b_complete.status_code == 404

