from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.security import create_access_token, hash_password
from app.crud.user import create_user
from app.models.learning_profile import LearningProfile
from app.models.user import User
from app.models.word import Word
from app.schemas.user import UserCreate


def test_create_word_success(client: TestClient, auth_headers: dict[str, str]):
    payload = {
        "language_code": "en",
        "text": "ubiquitous",
        "lemma": "ubiquitous",
        "pos": "adjective",
        "phonetic": "/juːˈbɪk.wə.təs/",
        "translation": "вездесущий, повсеместный",
        "context_phrase": "Smartphones have become ubiquitous.",
        "audio_url": "https://example.com/audio/ubiquitous.mp3",
    }
    response = client.post("/api/v1/words/", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["text"] == "ubiquitous"
    assert data["language_code"] == "en"
    assert data["lemma"] == "ubiquitous"
    assert data["translation"] == "вездесущий, повсеместный"
    assert data["id"] is not None


def test_create_word_invalid_language(client: TestClient, auth_headers: dict[str, str]):
    payload = {
        "language_code": "xx",
        "text": "testword",
    }
    response = client.post("/api/v1/words/", json=payload, headers=auth_headers)
    assert response.status_code == 400
    assert "does not exist" in response.json()["detail"]


def test_list_words_filtering(
    client: TestClient, sample_words: list[Word], auth_headers: dict[str, str]
):
    # List words for default profile ('en')
    r_en = client.get("/api/v1/words/", headers=auth_headers)
    assert r_en.status_code == 200
    assert len(r_en.json()) == 2  # 'ephemeral' and 'serendipity'

    # Filter by language 'nl'
    r_nl = client.get("/api/v1/words/?language_code=nl", headers=auth_headers)
    assert r_nl.status_code == 200
    assert len(r_nl.json()) == 1
    assert r_nl.json()[0]["text"] == "gezellig"

    # Search filter
    r_search = client.get("/api/v1/words/?search=serendipity", headers=auth_headers)
    assert r_search.status_code == 200
    assert len(r_search.json()) == 1
    assert r_search.json()[0]["text"] == "serendipity"


def test_get_word_by_id(
    client: TestClient, sample_words: list[Word], auth_headers: dict[str, str]
):
    target = sample_words[0]
    response = client.get(f"/api/v1/words/{target.id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == target.id
    assert data["text"] == target.text


def test_get_nonexistent_word(client: TestClient, auth_headers: dict[str, str]):
    response = client.get("/api/v1/words/99999", headers=auth_headers)
    assert response.status_code == 404


def test_delete_word_authenticated(
    client: TestClient, sample_words: list[Word], auth_headers: dict[str, str]
):
    target = sample_words[0]
    response = client.delete(f"/api/v1/words/{target.id}", headers=auth_headers)
    assert response.status_code == 204

    # Verify word is no longer accessible to this user
    get_res = client.get(f"/api/v1/words/{target.id}", headers=auth_headers)
    assert get_res.status_code == 404


def test_multi_user_word_isolation(
    client: TestClient,
    sample_words: list[Word],
    auth_headers: dict[str, str],
    db_session: Session,
):
    # User A has sample_words
    res_a = client.get("/api/v1/words/", headers=auth_headers)
    assert res_a.status_code == 200
    assert len(res_a.json()) >= 1

    # Create User B
    user_b_in = UserCreate(
        username="user_b",
        password="password123",
        default_source_lang="ru",
        default_target_lang="en",
    )
    user_b = create_user(db_session, user_b_in, hashed_password=hash_password(user_b_in.password))
    profile_b = LearningProfile(
        user_id=user_b.id,
        source_language="ru",
        target_language="en",
        is_active=True,
    )
    db_session.add(profile_b)
    db_session.commit()

    token_b = create_access_token(data={"sub": str(user_b.id), "username": user_b.username})
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B lists words -> should see 0 words
    res_b = client.get("/api/v1/words/", headers=headers_b)
    assert res_b.status_code == 200
    assert len(res_b.json()) == 0

    # User B tries to get User A's word by ID -> should return 404
    target = sample_words[0]
    res_b_get = client.get(f"/api/v1/words/{target.id}", headers=headers_b)
    assert res_b_get.status_code == 404

    # User B tries to delete User A's word -> should return 404
    res_b_del = client.delete(f"/api/v1/words/{target.id}", headers=headers_b)
    assert res_b_del.status_code == 404

    # Verify User A still has the word
    res_a_get = client.get(f"/api/v1/words/{target.id}", headers=auth_headers)
    assert res_a_get.status_code == 200
