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
