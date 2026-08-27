from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.stats import get_user_word_stats
from app.models.user import User
from app.models.word import Word


def test_get_due_reviews_new_words(
    client: TestClient,
    sample_words: list[Word],
    auth_headers: dict[str, str],
):
    # For a new user, all words in default target language ('en') should be returned as new due cards
    response = client.get("/api/v1/review/due", headers=auth_headers)
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 2  # 2 English words in sample_words
    for item in items:
        assert item["is_new"] is True
        assert item["stats"] is None
        assert item["word"]["language_code"] == "en"


def test_get_due_reviews_filter_target_lang(
    client: TestClient,
    sample_words: list[Word],
    auth_headers: dict[str, str],
):
    # Filter by Dutch ('nl')
    response = client.get("/api/v1/review/due?target_lang=nl", headers=auth_headers)
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["word"]["text"] == "gezellig"
    assert items[0]["word"]["language_code"] == "nl"


def test_submit_review_good_and_progression(
    client: TestClient,
    sample_words: list[Word],
    auth_headers: dict[str, str],
    test_user: User,
    db_session: Session,
):
    word = sample_words[0]  # English word 'ephemeral'

    # Submit 1st review: "good"
    r1 = client.post(
        "/api/v1/review/submit",
        json={"word_id": word.id, "rating": "good"},
        headers=auth_headers,
    )
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["score"] == 4
    assert d1["stats"]["repetition_number"] == 1
    assert d1["stats"]["interval_days"] == 1.0
    assert d1["stats"]["recall_count"] == 1
    assert d1["stats"]["fail_count"] == 0
    assert d1["stats"]["ease_factor"] == 2.5

    # Check that in DB it is stored
    stats = get_user_word_stats(db_session, user_id=test_user.id, word_id=word.id)
    assert stats is not None
    assert stats.repetition_number == 1
    assert stats.interval_days == 1.0

    # Since it is scheduled for tomorrow, it should not appear in due list right now
    r_due = client.get("/api/v1/review/due?target_lang=en", headers=auth_headers)
    due_word_ids = [item["word"]["id"] for item in r_due.json()]
    assert word.id not in due_word_ids

    # Submit 2nd review: "good"
    r2 = client.post(
        "/api/v1/review/submit",
        json={"word_id": word.id, "rating": "good"},
        headers=auth_headers,
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["stats"]["repetition_number"] == 2
    assert d2["stats"]["interval_days"] == 6.0
    assert d2["stats"]["recall_count"] == 2


def test_submit_review_easy_increases_ef(
    client: TestClient,
    sample_words: list[Word],
    auth_headers: dict[str, str],
):
    word = sample_words[1]  # English word 'serendipity'

    r = client.post(
        "/api/v1/review/submit",
        json={"word_id": word.id, "rating": "easy"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    d = r.json()
    assert d["score"] == 5
    assert d["stats"]["ease_factor"] == 2.6
    assert d["stats"]["repetition_number"] == 1
    assert d["stats"]["interval_days"] == 1.0


def test_submit_review_again_resets_repetition(
    client: TestClient,
    sample_words: list[Word],
    auth_headers: dict[str, str],
):
    word = sample_words[0]

    # First advance to repetition 2
    client.post(
        "/api/v1/review/submit",
        json={"word_id": word.id, "rating": "good"},
        headers=auth_headers,
    )
    client.post(
        "/api/v1/review/submit",
        json={"word_id": word.id, "rating": "good"},
        headers=auth_headers,
    )

    # Now fail with "again"
    r_fail = client.post(
        "/api/v1/review/submit",
        json={"word_id": word.id, "rating": "again"},
        headers=auth_headers,
    )
    assert r_fail.status_code == 200
    d_fail = r_fail.json()
    assert d_fail["score"] == 1
    assert d_fail["stats"]["repetition_number"] == 0
    assert d_fail["stats"]["interval_days"] == 1.0
    assert d_fail["stats"]["fail_count"] == 1
    assert d_fail["stats"]["recall_count"] == 2
    assert d_fail["stats"]["ease_factor"] < 2.5


def test_submit_review_numeric_rating(
    client: TestClient,
    sample_words: list[Word],
    auth_headers: dict[str, str],
):
    word = sample_words[0]
    response = client.post(
        "/api/v1/review/submit",
        json={"word_id": word.id, "rating": 3},  # Hard
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["score"] == 3
    assert data["stats"]["ease_factor"] == 2.36


def test_submit_review_nonexistent_word(
    client: TestClient,
    auth_headers: dict[str, str],
):
    response = client.post(
        "/api/v1/review/submit",
        json={"word_id": 99999, "rating": "good"},
        headers=auth_headers,
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


def test_submit_review_invalid_rating(
    client: TestClient,
    sample_words: list[Word],
    auth_headers: dict[str, str],
):
    word = sample_words[0]
    response = client.post(
        "/api/v1/review/submit",
        json={"word_id": word.id, "rating": "super_awesome"},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_unauthenticated_review_access(client: TestClient):
    r_due = client.get("/api/v1/review/due")
    assert r_due.status_code == 401

    r_submit = client.post(
        "/api/v1/review/submit",
        json={"word_id": 1, "rating": "good"},
    )
    assert r_submit.status_code == 401
