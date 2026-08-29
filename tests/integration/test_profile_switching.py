from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User


def test_profile_creation_switching_and_word_isolation(
    client: TestClient, db_session: Session, test_user: User, auth_headers: dict[str, str]
):
    # 1. User creates profile en -> ru
    res_prof_ru = client.post(
        "/api/v1/profiles/",
        json={"source_language": "en", "target_language": "ru"},
        headers=auth_headers,
    )
    assert res_prof_ru.status_code == 201
    prof_ru_data = res_prof_ru.json()
    assert prof_ru_data["source_language"] == "en"
    assert prof_ru_data["target_language"] == "ru"
    assert prof_ru_data["is_active"] is True
    ru_profile_id = prof_ru_data["id"]

    # 2. Submit single word 'привет' via submit-text with active profile
    res_submit = client.post(
        "/api/v1/words/submit-text",
        json={"text": "привет", "wait": True},
        headers=auth_headers,
    )
    assert res_submit.status_code == 201
    submit_data = res_submit.json()
    assert submit_data["is_lesson"] is False
    assert submit_data["lesson"] is None
    assert submit_data["can_create_lesson"] is False
    assert len(submit_data["words"]) == 1

    created_word = submit_data["words"][0]
    assert created_word["text"] == "привет"
    assert created_word["language_code"] == "ru"

    # 3. Word is returned when querying words for en -> ru profile
    res_words_ru = client.get("/api/v1/words/", headers=auth_headers)
    assert res_words_ru.status_code == 200
    words_ru = res_words_ru.json()
    assert len(words_ru) == 1
    assert words_ru[0]["text"] == "привет"
    assert words_ru[0]["language_code"] == "ru"

    # 4. User creates / switches to en -> nl profile
    res_prof_nl = client.post(
        "/api/v1/profiles/",
        json={"source_language": "en", "target_language": "nl"},
        headers=auth_headers,
    )
    assert res_prof_nl.status_code == 201
    prof_nl_data = res_prof_nl.json()
    assert prof_nl_data["source_language"] == "en"
    assert prof_nl_data["target_language"] == "nl"
    assert prof_nl_data["is_active"] is True
    nl_profile_id = prof_nl_data["id"]

    # 5. Querying words in en -> nl profile returns 0 words (isolated from ru words)
    res_words_nl = client.get("/api/v1/words/", headers=auth_headers)
    assert res_words_nl.status_code == 200
    words_nl = res_words_nl.json()
    assert len(words_nl) == 0

    # 6. Switch back to en -> ru profile
    res_switch_ru = client.post(
        f"/api/v1/profiles/{ru_profile_id}/switch",
        headers=auth_headers,
    )
    assert res_switch_ru.status_code == 200
    assert res_switch_ru.json()["is_active"] is True

    # Word 'привет' is visible again
    res_words_ru_again = client.get("/api/v1/words/", headers=auth_headers)
    assert res_words_ru_again.status_code == 200
    words_ru_again = res_words_ru_again.json()
    assert len(words_ru_again) == 1
    assert words_ru_again[0]["text"] == "привет"
    assert words_ru_again[0]["language_code"] == "ru"


def test_submit_word_explicit_language_pair(
    client: TestClient, db_session: Session, test_user: User, auth_headers: dict[str, str]
):
    # Create en -> de profile
    client.post(
        "/api/v1/profiles/",
        json={"source_language": "en", "target_language": "de"},
        headers=auth_headers,
    )

    # Submit word passing explicit source_lang and target_lang
    res_submit = client.post(
        "/api/v1/words/submit-text",
        json={"text": "hallo", "source_lang": "en", "target_lang": "de", "wait": True},
        headers=auth_headers,
    )
    assert res_submit.status_code == 201
    data = res_submit.json()
    assert data["is_lesson"] is False
    assert data["words"][0]["language_code"] == "de"
