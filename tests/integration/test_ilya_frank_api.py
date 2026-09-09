"""Integration tests for Ilya Frank API endpoints and lesson preparation workflow."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.crud.lesson import create_lesson
from app.models.user import User
from app.schemas.lesson import LessonCreate
from app.services.ilya_frank import strip_glosses, validate_unadapted_fidelity


def test_prepare_lesson_generates_ilya_frank_data(
    client: TestClient, db_session: Session, test_user: User, auth_headers: dict[str, str]
):
    """Verify preparing a lesson from reading chunks generates and persists Ilya Frank dual-pass data."""
    raw_text = "Yesterday I decided to get off the train and give up junk food. It was a great decision."
    lesson_in = LessonCreate(
        source_lang="ru",
        target_lang="en",
        title="Frank Adaptation Test",
        raw_input=raw_text,
        input_type="reading",
        is_completed=False,
    )
    lesson = create_lesson(db_session, user_id=test_user.id, lesson_in=lesson_in, status="reading")

    res = client.post(
        f"/api/v1/lessons/{lesson.id}/prepare",
        headers=auth_headers,
        json={
            "selected_chunks": [
                {"text": "get off", "lemma": "get off", "pos": "phrase"},
                {"text": "give up", "lemma": "give up", "pos": "phrase"},
            ],
            "source_lang": "ru",
            "target_lang": "en",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == lesson.id
    assert data["status"] == "ready"

    # Verify ilya_frank_data is present in the response and contains excerpts
    assert data["ilya_frank_data"] is not None
    frank_data = data["ilya_frank_data"]
    assert "excerpts" in frank_data
    assert len(frank_data["excerpts"]) >= 1

    excerpt = frank_data["excerpts"][0]
    assert excerpt["index"] == 1
    assert "adapted_text" in excerpt
    assert "raw_text" in excerpt

    # Verify glosses are present for selected words
    assert "get off (" in excerpt["adapted_text"] or "give up (" in excerpt["adapted_text"]

    # Invariant: raw text matches stripped adapted text
    is_faithful, err = validate_unadapted_fidelity(excerpt["adapted_text"], excerpt["raw_text"])
    assert is_faithful, f"Fidelity error in prepared lesson: {err}"


def test_lesson_specific_ilya_frank_endpoint(
    client: TestClient, db_session: Session, test_user: User, auth_headers: dict[str, str]
):
    """Verify POST /api/v1/lessons/{lesson_id}/ilya-frank generates adaptation for existing lesson."""
    raw_text = "The dog barked happily and ran into the house."
    lesson_in = LessonCreate(
        source_lang="ru",
        target_lang="en",
        title="Barked Dog Lesson",
        raw_input=raw_text,
        input_type="reading",
        is_completed=False,
    )
    lesson = create_lesson(db_session, user_id=test_user.id, lesson_in=lesson_in, status="ready")

    res = client.post(
        f"/api/v1/lessons/{lesson.id}/ilya-frank",
        headers=auth_headers,
        json={"selected_words": ["barked", "house"]},
    )
    assert res.status_code == 200
    data = res.json()
    assert "excerpts" in data
    assert len(data["excerpts"]) >= 1
    assert "barked (" in data["excerpts"][0]["adapted_text"]


def test_standalone_ilya_frank_endpoint(client: TestClient, auth_headers: dict[str, str]):
    """Verify POST /api/v1/lessons/ilya-frank adapts arbitrary text."""
    res = client.post(
        "/api/v1/lessons/ilya-frank",
        headers=auth_headers,
        json={
            "text": "Ik lees een goed boek in de rustige avond.",
            "selected_words": ["boek"],
            "source_lang": "ru",
            "target_lang": "nl",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["excerpts"]) >= 1
    excerpt = data["excerpts"][0]
    assert "boek (" in excerpt["adapted_text"]
    assert strip_glosses(excerpt["adapted_text"]) == excerpt["raw_text"]
