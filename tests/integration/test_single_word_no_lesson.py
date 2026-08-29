import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.lesson import Lesson
from app.models.word import Word
from app.models.user import User


def test_single_word_submission_creates_no_lesson(
    client: TestClient,
    db_session: Session,
    auth_headers: dict[str, str],
    test_user: User,
):
    """
    Verify that submitting a single word via POST /api/v1/words/submit-text
    only extracts and saves the word, without creating any Lesson record.
    """
    # Verify initial state: 0 lessons
    initial_lessons = db_session.query(Lesson).filter_by(user_id=test_user.id).all()
    assert len(initial_lessons) == 0

    response = client.post(
        "/api/v1/words/submit-text",
        headers=auth_headers,
        json={
            "text": "привет",
            "source_lang": "en",
            "target_lang": "ru",
            "wait": True,
        },
    )

    assert response.status_code in [200, 201]
    data = response.json()
    assert data["is_lesson"] is False
    assert data["can_create_lesson"] is False
    assert data["lesson"] is None
    assert len(data["words"]) >= 1

    # Verify database state: no lessons created for this user
    user_lessons = db_session.query(Lesson).filter_by(user_id=test_user.id).all()
    assert len(user_lessons) == 0

    # Verify word exists
    words = db_session.query(Word).filter_by(language_code="ru").all()
    assert any("привет" in w.text.lower() or "привет" in w.translation.lower() for w in words)
