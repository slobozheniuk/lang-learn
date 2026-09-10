"""Integration tests for Ilya Frank API endpoints and lesson preparation workflow."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import settings
from app.crud.lesson import create_lesson
from app.models.user import User
from app.schemas.lesson import LessonCreate
from app.services.ilya_frank import (
    strip_glosses,
    validate_punctuation_invariant,
    validate_unadapted_fidelity,
)
from app.services.job_queue import job_queue_service
from app.services.llm.factory import get_llm_provider


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


@pytest.mark.skipif(not settings.effective_llm_api_key, reason="Real LLM API key required")
def test_ilya_frank_method_real_api(client: TestClient, auth_headers: dict[str, str]):
    """E2E test case for Ilya Frank method using real LLM API."""
    text = (
        "De vogels vonden het nu toch ook stillekesaan genoeg. Ze besloten een koning te kiezen, "
        "die moest dan maar een einde maken aan al die twisten. Een koning, die heeft macht, "
        "die geeft bevelen en de anderen moeten luisteren.\n"
        "Maar hoe kies ge een koning? Dat was niet zo moeilijk. De vogel die het hoogst kon vliegen werd koning. Wie anders?"
    )

    expected_adapted_text = (
        "De vogels vonden het nu toch ook stillekesaan genoeg (птицам это тоже стало "
        "постепенно надоедать: «птицы находили это теперь все-таки также "
        "постепенно довольно»; stilletjesaan = stillekesaan = langzaamaan = "
        "geleidelijk — постепенно). Ze besloten een koning te kiezen (они решили "
        "выбрать короля), die moest dan maar een einde maken aan al die twisten (он "
        "должен был тогда всем тем спорам положить конец). Een koning, die heeft "
        "macht (король — тот имеет власть), die geeft bevelen (тот дает указы) en de "
        "anderen moeten luisteren (и другие должны слушаться).\n"
        "Maar hoe kies ge een koning (но как ты выбираешь короля)? Dat was niet zo "
        "moeilijk (это было не так трудно). De vogel die het hoogst kon vliegen werd "
        "koning (птица, которая выше всех сумела взлететь, становилась королем). "
        "Wie anders (кто иначе = кто же еще)?"
    )

    prev_provider = job_queue_service._llm_provider
    real_provider = get_llm_provider(force_mock=False)
    job_queue_service.set_llm_provider(real_provider)
    try:
        res = client.post(
            "/api/v1/lessons/ilya-frank",
            headers=auth_headers,
            json={
                "text": text,
                "selected_words": [],
                "source_lang": "ru",
                "target_lang": "nl",
            },
        )
        assert res.status_code == 200
        data = res.json()

        assert "excerpts" in data
        assert len(data["excerpts"]) == 1
        exc = data["excerpts"][0]

        # Invariant 1: raw_text matches original source text exactly
        assert exc["raw_text"].strip() == text.strip()

        # Invariant 2: unadapted passage fidelity (strip_glosses(adapted_text) == raw_text)
        is_faithful, err = validate_unadapted_fidelity(exc["adapted_text"], exc["raw_text"])
        assert is_faithful, f"Fidelity invariant failed: {err}"

        # Invariant 3: bracket & punctuation invariant (Rule 3)
        is_punct_valid, punct_errs = validate_punctuation_invariant(exc["adapted_text"])
        assert is_punct_valid, f"Punctuation invariant failed: {punct_errs}"

        # Invariant 4: extracted vocabulary contains essential words/lemmas
        vocab_lemmas = {w.get("lemma") or w.get("text") for w in exc.get("vocabulary_extracted", [])}
        expected_lemmas_subset = {"vogel", "vinden", "stillekesaan", "besluiten", "koning", "kiezen", "twist"}
        assert any(l in vocab_lemmas for l in expected_lemmas_subset), (
            f"Expected some of {expected_lemmas_subset} in extracted vocabulary lemmas: {vocab_lemmas}"
        )

        # Invariant 5: Key syntagms / clauses are glossed at natural syntactic boundaries
        assert "stillekesaan genoeg (" in exc["adapted_text"]
        assert "te kiezen (" in exc["adapted_text"] or "koning (" in exc["adapted_text"]
        assert "Wie anders (" in exc["adapted_text"]

        # Note: Live LLMs have slight sampling variance across sequential calls
        # (e.g., '(кто же еще)?' vs '(кто же еще: «кто иначе»)?').
        # The exact response from the initial run is saved in tests/integration/ilya_frank_real_response.json.
        # To test strict byte-for-byte matching on a fixed payload, use:
        # assert exc["adapted_text"] == expected_adapted_text
    finally:
        job_queue_service.set_llm_provider(prev_provider)
