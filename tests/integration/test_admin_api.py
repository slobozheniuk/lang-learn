import json
import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import settings
from app.crud.user import ensure_admin_user
from app.services.journey_logger import log_journey_event


def get_admin_token(client: TestClient, db_session: Session) -> str:
    # Ensure admin user is seeded in DB
    ensure_admin_user(db_session)
    res = client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": settings.ADMIN_USERNAME,
            "password": settings.ADMIN_PASSWORD,
        },
    )
    assert res.status_code == 200, f"Login failed: {res.text}"
    return res.json()["access_token"]


def test_admin_access_forbidden_for_regular_user(client: TestClient):
    # Register a standard user
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": "regular_user_1",
            "password": "password123",
            "source_language": "ru",
            "target_language": "en",
        },
    )
    assert reg.status_code == 201
    token = reg.json()["token"]["access_token"]

    # Attempt to access admin endpoints
    res_users = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert res_users.status_code == 403
    assert res_users.json()["detail"] == "Admin privileges required"

    res_logs = client.get("/api/v1/admin/logs/journeys", headers={"Authorization": f"Bearer {token}"})
    assert res_logs.status_code == 403


def test_admin_users_stats_endpoint(client: TestClient, db_session: Session):
    admin_token = get_admin_token(client, db_session)

    # Register user and add a lesson / words
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": "learner_stats_user",
            "password": "password123",
            "source_language": "ru",
            "target_language": "en",
        },
    )
    assert reg.status_code == 201
    user_token = reg.json()["token"]["access_token"]

    # Add a word
    client.post(
        "/api/v1/words/",
        headers={"Authorization": f"Bearer {user_token}"},
        json={
            "text": "testword",
            "translation": "тестовоеслово",
            "language_code": "en",
        },
    )

    # Get admin users list
    res = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    users = res.json()
    assert isinstance(users, list)
    assert len(users) >= 2  # Admin + learner_stats_user

    # Find learner_stats_user
    learner = next((u for u in users if u["username"] == "learner_stats_user"), None)
    assert learner is not None
    assert learner["is_admin"] is False
    assert learner["word_count"] >= 1


def test_log_journey_parser_endpoint(client: TestClient, db_session: Session):
    admin_token = get_admin_token(client, db_session)

    # Directly emit a full journey event simulating lesson creation
    journey_id = f"test_journey_lesson_{uuid.uuid4().hex[:8]}"
    log_journey_event(
        journey_id=journey_id,
        journey_type="lesson_creation",
        stage="text_submitted",
        action="Lesson Text Submitted",
        user_id=42,
        username="journey_tester",
        data={"text": "The quick brown fox jumps over the lazy dog.", "word_count": 9},
    )
    log_journey_event(
        journey_id=journey_id,
        journey_type="lesson_creation",
        stage="chunks_selected",
        action="Chunks Selected by User",
        user_id=42,
        username="journey_tester",
        data={"chosen_chunks": ["fox", "lazy dog"]},
    )
    log_journey_event(
        journey_id=journey_id,
        journey_type="lesson_creation",
        stage="llm_quiz_request",
        action="LLM Quiz Generation Request",
        user_id=42,
        username="journey_tester",
        data={"input_prompt": "Generate a 4-choice quiz question for 'lazy dog'"},
    )
    log_journey_event(
        journey_id=journey_id,
        journey_type="lesson_creation",
        stage="llm_quiz_response",
        action="LLM Quiz Generation Response",
        user_id=42,
        username="journey_tester",
        data={"output": json.dumps({"title": "Fox and Dog Quiz", "questions": []})},
    )
    log_journey_event(
        journey_id=journey_id,
        journey_type="lesson_creation",
        stage="lesson_ready",
        action="Lesson Ready with Quiz",
        user_id=42,
        username="journey_tester",
        data={"lesson_id": 999, "title": "Fox and Dog Quiz"},
    )

    # Fetch parsed log journeys
    res = client.get("/api/v1/admin/logs/journeys", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    journeys = res.json()
    assert isinstance(journeys, list)

    target_journey = next((j for j in journeys if j["journey_id"] == journey_id), None)
    assert target_journey is not None
    assert target_journey["username"] == "journey_tester"
    assert target_journey["journey_type"] == "lesson_creation"
    assert target_journey["status"] == "completed"
    assert "fox" in target_journey["chosen_chunks"]
    assert "lazy dog" in target_journey["chosen_chunks"]

    # Verify action progress
    action_names = [a["name"] for a in target_journey["actions"]]
    assert "Lesson Text Submitted" in action_names
    assert "Chunks Selected by User" in action_names
    assert "Lesson Ready with Quiz" in action_names

    # Verify LLM interaction with prompt and output
    assert len(target_journey["llm_interactions"]) >= 1
    llm_interaction = target_journey["llm_interactions"][0]
    assert "Generate a 4-choice quiz question" in llm_interaction["prompt"]
    assert "Fox and Dog Quiz" in llm_interaction["output"]
