from fastapi.testclient import TestClient


def test_register_success(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
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
    assert data["user"]["email"] == "newuser@example.com"
    assert data["user"]["username"] == "newuser"
    assert data["token"]["token_type"] == "bearer"
    assert len(data["token"]["access_token"]) > 10


def test_register_duplicate_email(client: TestClient):
    payload = {
        "email": "dup@example.com",
        "username": "dupuser1",
        "password": "secretpassword",
        "default_source_lang": "ru",
        "default_target_lang": "en",
    }
    r1 = client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201

    payload2 = {
        "email": "dup@example.com",
        "username": "dupuser2",
        "password": "secretpassword",
        "default_source_lang": "ru",
        "default_target_lang": "en",
    }
    r2 = client.post("/api/v1/auth/register", json=payload2)
    assert r2.status_code == 400
    assert "email already exists" in r2.json()["detail"]


def test_register_duplicate_username(client: TestClient):
    payload = {
        "email": "user1@example.com",
        "username": "sameusername",
        "password": "secretpassword",
        "default_source_lang": "ru",
        "default_target_lang": "en",
    }
    r1 = client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201

    payload2 = {
        "email": "user2@example.com",
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
        "email": "langtest@example.com",
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
            "email": "loginuser@example.com",
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

    # Login with email
    r2 = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "loginuser@example.com", "password": "password123"},
    )
    assert r2.status_code == 200
    assert "access_token" in r2.json()


def test_login_oauth2_form_success(client: TestClient):
    # Register first
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "formuser@example.com",
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
            "email": "wrongpw@example.com",
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


def test_get_me_authenticated(client: TestClient, auth_headers: dict[str, str]):
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"
    assert data["email"] == "testuser@example.com"


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
