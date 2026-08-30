from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import create_access_token, hash_password
from app.crud.lesson import add_word_to_lesson, create_lesson
from app.crud.user import create_user
from app.models.job import Job
from app.models.learning_profile import LearningProfile
from app.models.lesson import Lesson
from app.models.lesson_word import LessonWord
from app.models.user import User
from app.models.word import Word
from app.schemas.lesson import LessonCreate
from app.schemas.user import UserCreate


def test_delete_lesson_success(
    client: TestClient,
    db_session: Session,
    test_user: User,
    auth_headers: dict[str, str],
    sample_words: list[Word],
):
    # Create a lesson
    lesson_in = LessonCreate(
        source_lang="ru",
        target_lang="en",
        title="Lesson To Delete",
        raw_input="sample raw text",
        input_type="quiz",
        is_completed=False,
    )
    lesson = create_lesson(db_session, user_id=test_user.id, lesson_in=lesson_in, status="ready")
    lesson_id = lesson.id

    # Add words to lesson
    for idx, w in enumerate(sample_words):
        add_word_to_lesson(db_session, lesson_id=lesson_id, word_id=w.id, order_index=idx)

    # Link a Job to this lesson
    job = Job(
        user_id=test_user.id,
        type="quiz_generation",
        status="completed",
        input_text="sample raw text",
        source_lang="ru",
        target_lang="en",
        lesson_id=lesson_id,
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    assert job.lesson_id == lesson_id

    # Verify lesson exists in API
    res = client.get("/api/v1/lessons/", headers=auth_headers)
    assert res.status_code == 200
    assert any(l["id"] == lesson_id for l in res.json())

    # Call DELETE /api/v1/lessons/{lesson_id}
    res_del = client.delete(f"/api/v1/lessons/{lesson_id}", headers=auth_headers)
    assert res_del.status_code == 204

    # Verify lesson is removed from DB
    assert db_session.scalar(select(Lesson).where(Lesson.id == lesson_id)) is None

    # Verify LessonWord associations are removed
    lws = db_session.scalars(select(LessonWord).where(LessonWord.lesson_id == lesson_id)).all()
    assert len(list(lws)) == 0

    # Verify Job.lesson_id is nullified (or handled cleanly)
    db_session.refresh(job)
    assert job.lesson_id is None

    # Verify words still exist in database
    for w in sample_words:
        assert db_session.scalar(select(Word).where(Word.id == w.id)) is not None

    # Verify lesson is removed from API
    res_after = client.get("/api/v1/lessons/", headers=auth_headers)
    assert res_after.status_code == 200
    assert not any(l["id"] == lesson_id for l in res_after.json())


def test_delete_lesson_not_found(client: TestClient, auth_headers: dict[str, str]):
    response = client.delete("/api/v1/lessons/99999", headers=auth_headers)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_delete_lesson_unauthorized_user_isolation(
    client: TestClient,
    db_session: Session,
    test_user: User,
    auth_headers: dict[str, str],
):
    # Create lesson for test_user (User A)
    lesson_in = LessonCreate(
        source_lang="ru",
        target_lang="en",
        title="User A Lesson",
        raw_input="test input",
        input_type="text",
    )
    lesson_a = create_lesson(db_session, user_id=test_user.id, lesson_in=lesson_in, status="ready")

    # Create User B
    user_b_in = UserCreate(
        username="user_b_tester",
        password="testpassword123",
        default_source_lang="ru",
        default_target_lang="en",
    )
    user_b = create_user(db_session, user_b_in, hashed_password=hash_password("testpassword123"))
    prof_b = LearningProfile(
        user_id=user_b.id,
        source_language="ru",
        target_language="en",
        is_active=True,
    )
    db_session.add(prof_b)
    db_session.commit()
    token_b = create_access_token(data={"sub": str(user_b.id), "username": user_b.username})
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B attempts to delete User A's lesson
    res = client.delete(f"/api/v1/lessons/{lesson_a.id}", headers=headers_b)
    assert res.status_code == 404

    # Verify User A's lesson is intact
    res_a = client.get(f"/api/v1/lessons/{lesson_a.id}", headers=auth_headers)
    assert res_a.status_code == 200
    assert res_a.json()["id"] == lesson_a.id


def test_delete_lesson_unauthenticated(
    client: TestClient, db_session: Session, test_user: User
):
    lesson_in = LessonCreate(
        source_lang="ru",
        target_lang="en",
        title="Unauthenticated Test Lesson",
        raw_input="text",
    )
    lesson = create_lesson(db_session, user_id=test_user.id, lesson_in=lesson_in, status="ready")

    # No auth header
    res = client.delete(f"/api/v1/lessons/{lesson.id}")
    assert res.status_code == 401


def test_chunk_text_endpoint(client: TestClient, auth_headers: dict[str, str]):
    text = "Yesterday I decided to wake up early and get off the train."
    res = client.post(
        "/api/v1/lessons/chunk-text",
        headers=auth_headers,
        json={"text": text, "source_lang": "ru", "target_lang": "en", "create_lesson": False},
    )
    assert res.status_code == 200
    data = res.json()
    assert "chunks" in data
    assert len(data["chunks"]) > 0
    assert data["lesson_id"] is None
    assert data["raw_text"] == text

    # Verify selectable chunks exist
    selectable = [c for c in data["chunks"] if c.get("is_selectable")]
    assert len(selectable) > 0


def test_chunk_text_creates_reading_lesson(client: TestClient, auth_headers: dict[str, str]):
    text = "I decided to give up sugar and look forward to healthy life."
    res = client.post(
        "/api/v1/lessons/chunk-text",
        headers=auth_headers,
        json={"text": text, "source_lang": "ru", "target_lang": "en", "create_lesson": True, "title": "Healthy Habits"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["lesson_id"] is not None
    lesson_id = data["lesson_id"]

    # Verify lesson is retrieved with status reading and chunk_data
    res_l = client.get(f"/api/v1/lessons/{lesson_id}", headers=auth_headers)
    assert res_l.status_code == 200
    lesson_data = res_l.json()
    assert lesson_data["status"] == "reading"
    assert lesson_data["input_type"] == "reading"
    assert lesson_data["chunk_data"] is not None
    assert lesson_data["title"] == "Healthy Habits"


def test_prepare_lesson_with_existing_lesson(
    client: TestClient, db_session: Session, test_user: User, auth_headers: dict[str, str]
):
    # 1. Create a reading lesson
    lesson_in = LessonCreate(
        source_lang="ru",
        target_lang="en",
        title="Interactive Reading Test",
        raw_input="I want to give up junk food and get off early.",
        input_type="reading",
        is_completed=False,
    )
    lesson = create_lesson(db_session, user_id=test_user.id, lesson_in=lesson_in, status="reading")

    # 2. Select only 2 items: "give up" and "junk food"
    res = client.post(
        f"/api/v1/lessons/{lesson.id}/prepare",
        headers=auth_headers,
        json={
            "selected_chunks": [
                {"text": "give up", "lemma": "give up", "pos": "phrase"},
                {"text": "junk food", "lemma": "junk food", "pos": "noun"},
            ],
            "source_lang": "ru",
            "target_lang": "en",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == lesson.id
    assert data["status"] == "ready"
    assert data["input_type"] == "quiz"
    assert data["quiz_data"] is not None

    # Verify only the 2 selected words were extracted and added to lesson
    words = data["words"]
    word_texts = [w["text"].lower() for w in words]
    assert "give up" in word_texts
    assert "junk food" in word_texts
    assert len(words) == 2


def test_prepare_lesson_without_lesson_id(client: TestClient, auth_headers: dict[str, str]):
    res = client.post(
        "/api/v1/lessons/prepare",
        headers=auth_headers,
        json={
            "selected_words": ["serendipity", "epiphany"],
            "source_lang": "ru",
            "target_lang": "en",
            "title": "Rare Words Quiz",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Rare Words Quiz"
    assert data["input_type"] == "quiz"
    assert data["quiz_data"] is not None
    assert len(data["words"]) == 2


def test_prepare_lesson_empty_selection_validation(client: TestClient, auth_headers: dict[str, str]):
    res = client.post(
        "/api/v1/lessons/prepare",
        headers=auth_headers,
        json={
            "selected_chunks": [],
            "source_lang": "ru",
            "target_lang": "en",
        },
    )
    assert res.status_code == 400
    assert "at least one word/chunk" in res.json()["detail"].lower()

