from fastapi.testclient import TestClient


def test_register_success(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "newuser",
            "password": "secretpassword",
            "default_source_lang": "ru",
            "default_target_lang": "en",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "user" in data
    assert "token" in data
    assert data["user"]["username"] == "newuser"
    assert data["token"]["token_type"] == "bearer"
    assert len(data["token"]["access_token"]) > 10
    # Verify default learning profile was created
    assert "profiles" in data["user"]
    assert len(data["user"]["profiles"]) >= 1
    assert data["user"]["profiles"][0]["source_language"] == "ru"
    assert data["user"]["profiles"][0]["target_language"] == "en"
    assert data["user"]["profiles"][0]["is_active"] is True


def test_register_creates_default_learning_profile(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "profileuser",
            "password": "secretpassword",
            "native_language": "en",
            "target_language": "nl",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["username"] == "profileuser"
    assert data["user"]["native_language"] == "en"
    assert data["user"]["target_language"] == "nl"
    assert len(data["user"]["profiles"]) == 1
    profile = data["user"]["profiles"][0]
    assert profile["source_language"] == "en"
    assert profile["target_language"] == "nl"
    assert profile["is_active"] is True


def test_register_duplicate_username(client: TestClient):
    payload = {
        "username": "sameusername",
        "password": "secretpassword",
        "default_source_lang": "ru",
        "default_target_lang": "en",
    }
    r1 = client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201

    payload2 = {
        "username": "sameusername",
        "password": "secretpassword",
        "default_source_lang": "ru",
        "default_target_lang": "en",
    }
    r2 = client.post("/api/v1/auth/register", json=payload2)
    assert r2.status_code == 400
    assert "username already exists" in r2.json()["detail"]


def test_register_invalid_language(client: TestClient):
    payload = {
        "username": "langtest",
        "password": "secretpassword",
        "default_source_lang": "xx",
        "default_target_lang": "en",
    }
    r = client.post("/api/v1/auth/register", json=payload)
    assert r.status_code == 400
    assert "Invalid default source language" in r.json()["detail"]


def test_login_json_success(client: TestClient):
    # Register first
    client.post(
        "/api/v1/auth/register",
        json={
            "username": "loginuser",
            "password": "password123",
            "default_source_lang": "ru",
            "default_target_lang": "en",
        },
    )

    # Login with username
    r1 = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "loginuser", "password": "password123"},
    )
    assert r1.status_code == 200
    assert "access_token" in r1.json()


def test_login_oauth2_form_success(client: TestClient):
    # Register first
    client.post(
        "/api/v1/auth/register",
        json={
            "username": "formuser",
            "password": "password123",
            "default_source_lang": "ru",
            "default_target_lang": "en",
        },
    )

    response = client.post(
        "/api/v1/auth/login/access-token",
        data={"username": "formuser", "password": "password123"},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_wrong_password(client: TestClient):
    client.post(
        "/api/v1/auth/register",
        json={
            "username": "wrongpw",
            "password": "correctpassword",
            "default_source_lang": "ru",
            "default_target_lang": "en",
        },
    )

    response = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "wrongpw", "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert "Incorrect" in response.json()["detail"]


def test_login_nonexistent_user(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "nonexistent_user", "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert "Incorrect" in response.json()["detail"]


def test_get_me_authenticated(client: TestClient, auth_headers: dict[str, str]):
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"
    assert data["is_active"] is True
    assert "profiles" in data


def test_get_me_unauthenticated(client: TestClient):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_get_me_invalid_token(client: TestClient):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid_token_123"})
    assert response.status_code == 401


def test_get_me_invalid_payload_sub(client: TestClient):
    from app.auth.security import create_access_token
    token = create_access_token(data={"sub": "not_an_integer_id"})
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_inactive_user_access(client: TestClient, db_session, test_user):
    from app.auth.security import create_access_token
    test_user.is_active = False
    db_session.commit()

    token = create_access_token(data={"sub": str(test_user.id)})
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 400
    assert "Inactive" in response.json()["detail"]


def test_register_with_native_and_target_language(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "languages_user",
            "password": "secretpassword",
            "native_language": "ru",
            "target_language": "nl",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["user"]["native_language"] == "ru"
    assert data["user"]["target_language"] == "nl"
    assert data["user"]["default_source_lang"] == "ru"
    assert data["user"]["default_target_lang"] == "nl"
    assert len(data["user"]["profiles"]) == 1
    assert data["user"]["profiles"][0]["source_language"] == "ru"
    assert data["user"]["profiles"][0]["target_language"] == "nl"


def test_get_me_returns_languages(client: TestClient, auth_headers: dict[str, str]):
    r1 = client.get("/api/v1/auth/me", headers=auth_headers)
    assert r1.status_code == 200
    d1 = r1.json()
    assert "native_language" in d1
    assert "target_language" in d1
    assert d1["native_language"] == "ru"
    assert d1["target_language"] == "en"

    r2 = client.get("/api/v1/users/me", headers=auth_headers)
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["native_language"] == "ru"
    assert d2["target_language"] == "en"


def test_update_me_languages_auth_endpoint(client: TestClient, auth_headers: dict[str, str]):
    response = client.patch(
        "/api/v1/auth/me",
        headers=auth_headers,
        json={
            "native_language": "nl",
            "target_language": "ru",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["native_language"] == "nl"
    assert data["target_language"] == "ru"
    assert data["default_source_lang"] == "nl"
    assert data["default_target_lang"] == "ru"

    # Verify persisted in GET /me
    get_res = client.get("/api/v1/auth/me", headers=auth_headers)
    assert get_res.json()["native_language"] == "nl"
    assert get_res.json()["target_language"] == "ru"


def test_update_me_languages_users_endpoint(client: TestClient, auth_headers: dict[str, str]):
    response = client.patch(
        "/api/v1/users/me",
        headers=auth_headers,
        json={
            "native_language": "ru",
            "target_language": "nl",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["native_language"] == "ru"
    assert data["target_language"] == "nl"


def test_update_me_invalid_language(client: TestClient, auth_headers: dict[str, str]):
    response = client.patch(
        "/api/v1/auth/me",
        headers=auth_headers,
        json={"native_language": "xx"},
    )
    assert response.status_code == 400
    assert "Invalid native language" in response.json()["detail"]

    response2 = client.patch(
        "/api/v1/auth/me",
        headers=auth_headers,
        json={"target_language": "xx"},
    )
    assert response2.status_code == 400
    assert "Invalid target language" in response2.json()["detail"]


def test_update_me_unauthenticated(client: TestClient):
    response = client.patch(
        "/api/v1/auth/me",
        json={"native_language": "en"},
    )
    assert response.status_code == 401
