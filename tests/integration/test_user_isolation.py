import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.security import create_access_token, hash_password
from app.crud.lesson import create_lesson
from app.crud.user import create_user
from app.models.learning_profile import LearningProfile
from app.models.user import User
from app.schemas.lesson import LessonCreate
from app.schemas.user import UserCreate


def create_authenticated_user(
    db: Session,
    username: str,
    source_lang: str = "ru",
    target_lang: str = "en",
) -> tuple[User, dict[str, str]]:
    user_in = UserCreate(
        username=username,
        password="testpassword123",
        default_source_lang=source_lang,
        default_target_lang=target_lang,
    )
    user = create_user(db, user_in, hashed_password=hash_password("testpassword123"))
    profile = LearningProfile(
        user_id=user.id,
        source_language=source_lang,
        target_language=target_lang,
        is_active=True,
    )
    db.add(profile)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": str(user.id), "username": user.username})
    headers = {"Authorization": f"Bearer {token}"}
    return user, headers


def test_strict_multi_user_isolation(client: TestClient, db_session: Session):
    # 1. User A registers and creates words, lessons, reviews
    user_a, headers_a = create_authenticated_user(db_session, "user_alpha", "ru", "en")

    # User A creates a word via POST /api/v1/words/
    res_w1 = client.post(
        "/api/v1/words/",
        headers=headers_a,
        json={"language_code": "en", "text": "serendipity", "translation": "случайность"},
    )
    assert res_w1.status_code == 201
    word_a1_id = res_w1.json()["id"]

    # User A creates a lesson via LessonCreate
    lesson_in = LessonCreate(
        source_lang="ru",
        target_lang="en",
        title="User A's Private Lesson",
        raw_input="serendipity",
        input_type="text",
        is_completed=False,
    )
    lesson_a = create_lesson(db_session, user_id=user_a.id, lesson_in=lesson_in, status="ready")

    # Verify User A has 1 word, 1 due review, 1 lesson
    res_words_a = client.get("/api/v1/words/", headers=headers_a)
    assert res_words_a.status_code == 200
    assert len(res_words_a.json()) == 1

    res_due_a = client.get("/api/v1/review/due", headers=headers_a)
    assert res_due_a.status_code == 200
    assert len(res_due_a.json()) == 1

    res_lessons_a = client.get("/api/v1/lessons/", headers=headers_a)
    assert res_lessons_a.status_code == 200
    assert len(res_lessons_a.json()) == 1

    # 2. User B registers
    user_b, headers_b = create_authenticated_user(db_session, "user_beta", "ru", "en")

    # User B lists words -> must see 0 words
    res_words_b = client.get("/api/v1/words/", headers=headers_b)
    assert res_words_b.status_code == 200
    assert len(res_words_b.json()) == 0

    # User B fetches due reviews -> must see 0 reviews
    res_due_b = client.get("/api/v1/review/due", headers=headers_b)
    assert res_due_b.status_code == 200
    assert len(res_due_b.json()) == 0

    # User B lists lessons -> must see 0 lessons
    res_lessons_b = client.get("/api/v1/lessons/", headers=headers_b)
    assert res_lessons_b.status_code == 200
    assert len(res_lessons_b.json()) == 0

    # 3. User B attempts unauthorized access to User A's data
    # Cannot get word by ID
    assert client.get(f"/api/v1/words/{word_a1_id}", headers=headers_b).status_code == 404

    # Cannot delete User A's word
    assert client.delete(f"/api/v1/words/{word_a1_id}", headers=headers_b).status_code == 404

    # Cannot get User A's lesson
    assert client.get(f"/api/v1/lessons/{lesson_a.id}", headers=headers_b).status_code == 404

    # Cannot complete User A's lesson
    assert client.post(f"/api/v1/lessons/{lesson_a.id}/complete", headers=headers_b).status_code == 404

    # Cannot delete User A's lesson
    assert client.delete(f"/api/v1/lessons/{lesson_a.id}", headers=headers_b).status_code == 404

    # 4. User A's data remains completely intact
    assert client.get(f"/api/v1/words/{word_a1_id}", headers=headers_a).status_code == 200
    assert client.get(f"/api/v1/lessons/{lesson_a.id}", headers=headers_a).status_code == 200



def test_active_profile_isolation(client: TestClient, db_session: Session):
    user, headers = create_authenticated_user(db_session, "profile_user", "ru", "en")

    # Add an English word
    client.post(
        "/api/v1/words/",
        headers=headers,
        json={"language_code": "en", "text": "ephemeral", "translation": "мимолетный"},
    )

    # Active profile is ru -> en, so GET /api/v1/words/ returns 1 word
    res_en = client.get("/api/v1/words/", headers=headers)
    assert res_en.status_code == 200
    assert len(res_en.json()) == 1
    assert res_en.json()[0]["language_code"] == "en"

    # Create and switch to Dutch profile (ru -> nl)
    res_prof = client.post(
        "/api/v1/profiles/",
        headers=headers,
        json={"source_language": "ru", "target_language": "nl"},
    )
    assert res_prof.status_code == 201

    # Active profile is now ru -> nl, so GET /api/v1/words/ returns 0 words
    res_nl = client.get("/api/v1/words/", headers=headers)
    assert res_nl.status_code == 200
    assert len(res_nl.json()) == 0

    # GET /api/v1/review/due returns 0 cards
    res_due_nl = client.get("/api/v1/review/due", headers=headers)
    assert res_due_nl.status_code == 200
    assert len(res_due_nl.json()) == 0

    # Add a Dutch word under ru -> nl profile
    client.post(
        "/api/v1/words/",
        headers=headers,
        json={"language_code": "nl", "text": "gezellig", "translation": "уютный"},
    )

    # Now GET /api/v1/words/ returns 1 Dutch word
    res_nl_2 = client.get("/api/v1/words/", headers=headers)
    assert res_nl_2.status_code == 200
    assert len(res_nl_2.json()) == 1
    assert res_nl_2.json()[0]["text"] == "gezellig"
