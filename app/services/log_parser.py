import json
import logging
import os
from pathlib import Path
from typing import Any
from pydantic import BaseModel, Field

from app.config import settings
from app.logging_config import get_log_dir

logger = logging.getLogger("app.log_parser")


class JourneyAction(BaseModel):
    name: str
    timestamp: str
    stage: str
    details: dict[str, Any] = Field(default_factory=dict)


class JourneyLLMInteraction(BaseModel):
    step: str
    prompt: str
    output: str
    timestamp: str


class JourneyLog(BaseModel):
    journey_id: str
    journey_type: str  # "word_adding" | "lesson_creation"
    user_id: int | None = None
    username: str | None = None
    timestamp: str
    status: str = "completed"  # "completed" | "in_progress" | "failed"
    input_text: str = ""
    chosen_chunks: list[str] = Field(default_factory=list)
    actions: list[JourneyAction] = Field(default_factory=list)
    llm_interactions: list[JourneyLLMInteraction] = Field(default_factory=list)


def parse_log_file(log_path: Path | None = None, limit: int = 50, journey_type_filter: str | None = None) -> list[JourneyLog]:
    """
    Parse the physical application log file line by line and reconstruct user journeys.
    Extracts:
    - User (id, username)
    - Timestamp
    - Progress of actions (step-by-step)
    - LLM requests (with input prompt) and outputs
    - Chunks chosen by the user
    """
    if log_path is None:
        log_path = get_log_dir() / settings.LOG_FILE_NAME

    if not log_path.exists():
        logger.warning(f"Log file not found at {log_path}")
        return []

    # Map of journey_id -> intermediate journey accumulator
    journeys_map: dict[str, dict[str, Any]] = {}
    journey_order: list[str] = []

    try:
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except Exception as e:
        logger.error(f"Failed to read log file {log_path}: {e}")
        return []

    for line in lines:
        if "[JOURNEY_EVENT]" not in line:
            continue

        # Extract timestamp from log header (format: "YYYY-MM-DD HH:MM:SS")
        log_time = ""
        parts = line.split("|", 1)
        if parts:
            log_time = parts[0].strip()

        # Extract JSON after [JOURNEY_EVENT]
        try:
            _, json_part = line.split("[JOURNEY_EVENT]", 1)
            event = json.loads(json_part.strip())
        except Exception as e:
            logger.debug(f"Failed to parse journey event json from line: {e}")
            continue

        j_id = str(event.get("journey_id") or "")
        if not j_id:
            continue

        if j_id not in journeys_map:
            journey_order.append(j_id)
            journeys_map[j_id] = {
                "journey_id": j_id,
                "journey_type": event.get("journey_type") or "word_adding",
                "user_id": event.get("user_id"),
                "username": event.get("username"),
                "timestamp": log_time,
                "status": "in_progress",
                "input_text": "",
                "chosen_chunks": [],
                "actions": [],
                "llm_interactions": [],
                "_pending_llm": {},
            }

        j = journeys_map[j_id]

        # Update metadata if newly available
        if event.get("user_id") and not j["user_id"]:
            j["user_id"] = event.get("user_id")
        if event.get("username") and not j["username"]:
            j["username"] = event.get("username")

        stage = event.get("stage", "")
        action_name = event.get("action", "")
        data = event.get("data") or {}

        # Add action to timeline
        j["actions"].append({
            "name": action_name or stage,
            "timestamp": log_time,
            "stage": stage,
            "details": data,
        })

        # Capture input text
        if not j["input_text"] and data.get("text"):
            j["input_text"] = data["text"]

        # Capture chosen chunks
        if data.get("chosen_chunks"):
            for ch in data["chosen_chunks"]:
                if ch not in j["chosen_chunks"]:
                    j["chosen_chunks"].append(ch)

        # Handle LLM interactions
        if "request" in stage:
            prompt = data.get("input_prompt") or data.get("prompt") or ""
            j["_pending_llm"][stage] = {
                "step": action_name,
                "prompt": prompt,
                "output": "",
                "timestamp": log_time,
            }
        elif "response" in stage:
            matching_req_stage = stage.replace("response", "request")
            req = j["_pending_llm"].pop(matching_req_stage, None)
            output = data.get("output") or data.get("response") or ""
            if req:
                req["output"] = output
                req["step"] = action_name
                j["llm_interactions"].append(req)
            else:
                j["llm_interactions"].append({
                    "step": action_name,
                    "prompt": "",
                    "output": output,
                    "timestamp": log_time,
                })

        # Determine completion status
        if stage in ("completed", "words_created", "lesson_ready"):
            j["status"] = "completed"
        elif "failed" in stage:
            j["status"] = "failed"

    # Convert accumulator dicts to JourneyLog Pydantic models
    results: list[JourneyLog] = []
    # Reverse to show newest journeys first
    for j_id in reversed(journey_order):
        raw = journeys_map[j_id]
        if journey_type_filter and raw["journey_type"] != journey_type_filter:
            continue

        # Flush any unclosed pending LLM requests
        for pending in raw["_pending_llm"].values():
            raw["llm_interactions"].append(pending)

        results.append(
            JourneyLog(
                journey_id=raw["journey_id"],
                journey_type=raw["journey_type"],
                user_id=raw["user_id"],
                username=raw["username"],
                timestamp=raw["timestamp"],
                status=raw["status"],
                input_text=raw["input_text"],
                chosen_chunks=raw["chosen_chunks"],
                actions=[JourneyAction(**a) for a in raw["actions"]],
                llm_interactions=[JourneyLLMInteraction(**i) for i in raw["llm_interactions"]],
            )
        )
        if len(results) >= limit:
            break

    return results
