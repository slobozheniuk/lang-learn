from fastapi.testclient import TestClient
from app.models.word import Word


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


def test_list_words_filtering(client: TestClient, sample_words: list[Word]):
    # List all words
    r_all = client.get("/api/v1/words/")
    assert r_all.status_code == 200
    assert len(r_all.json()) >= 3

    # Filter by language 'nl'
    r_nl = client.get("/api/v1/words/?language_code=nl")
    assert r_nl.status_code == 200
    assert len(r_nl.json()) == 1
    assert r_nl.json()[0]["text"] == "gezellig"

    # Search filter
    r_search = client.get("/api/v1/words/?search=serendipity")
    assert r_search.status_code == 200
    assert len(r_search.json()) == 1
    assert r_search.json()[0]["text"] == "serendipity"


def test_get_word_by_id(client: TestClient, sample_words: list[Word]):
    target = sample_words[0]
    response = client.get(f"/api/v1/words/{target.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == target.id
    assert data["text"] == target.text


def test_get_nonexistent_word(client: TestClient):
    response = client.get("/api/v1/words/99999")
    assert response.status_code == 404


def test_delete_word_authenticated(
    client: TestClient, sample_words: list[Word], auth_headers: dict[str, str]
):
    target = sample_words[0]
    response = client.delete(f"/api/v1/words/{target.id}", headers=auth_headers)
    assert response.status_code == 204

    # Verify word is deleted
    get_res = client.get(f"/api/v1/words/{target.id}")
    assert get_res.status_code == 404
