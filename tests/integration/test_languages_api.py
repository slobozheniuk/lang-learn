from fastapi.testclient import TestClient


def test_list_languages_seeded(client: TestClient):
    response = client.get("/api/v1/languages/")
    assert response.status_code == 200
    langs = response.json()
    codes = [l["code"] for l in langs]
    assert "en" in codes
    assert "ru" in codes
    assert "nl" in codes


def test_add_language_authenticated(client: TestClient, auth_headers: dict[str, str]):
    response = client.post(
        "/api/v1/languages/",
        json={"code": "es", "name": "Spanish"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["code"] == "es"
    assert data["name"] == "Spanish"

    # Verify listing includes the new language
    get_res = client.get("/api/v1/languages/")
    codes = [l["code"] for l in get_res.json()]
    assert "es" in codes


def test_add_duplicate_language_error(client: TestClient, auth_headers: dict[str, str]):
    response = client.post(
        "/api/v1/languages/",
        json={"code": "en", "name": "English Duplicate"},
        headers=auth_headers,
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_add_language_unauthorized(client: TestClient):
    response = client.post(
        "/api/v1/languages/",
        json={"code": "de", "name": "German"},
    )
    assert response.status_code == 401
