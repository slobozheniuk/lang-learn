import json
import logging
from typing import Any

journey_logger = logging.getLogger("app.journey")


def log_journey_event(
    journey_id: str,
    journey_type: str,  # "word_adding" | "lesson_creation"
    stage: str,
    action: str,
    user_id: int | None = None,
    username: str | None = None,
    data: dict[str, Any] | None = None,
) -> None:
    """
    Log a structured journey event into the standard application log file.
    This enables the admin log parser to reliably extract user journeys, action timelines,
    LLM prompts & responses, and selected chunks.
    """
    payload = {
        "journey_id": str(journey_id),
        "journey_type": journey_type,
        "stage": stage,
        "action": action,
        "user_id": user_id,
        "username": username,
        "data": data or {},
    }
    try:
        json_str = json.dumps(payload, ensure_ascii=False)
        journey_logger.info(f"[JOURNEY_EVENT] {json_str}")
    except Exception as err:
        journey_logger.error(f"Failed to serialize journey event: {err}")
