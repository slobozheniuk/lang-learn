from datetime import datetime
import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_admin_user
from app.database import get_db
from app.models.lesson import Lesson
from app.models.user import User
from app.models.user_word_stats import UserWordStats
from app.services.log_parser import JourneyLog, parse_log_file

logger = logging.getLogger("app.api.v1.admin")
router = APIRouter()


class AdminUserStats(BaseModel):
    id: int
    username: str
    is_admin: bool
    is_active: bool
    created_at: datetime
    lesson_count: int
    word_count: int


@router.get(
    "/users",
    response_model=list[AdminUserStats],
    summary="List all users with basic usage statistics (Admin only)",
)
def get_admin_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_current_admin_user),
) -> list[AdminUserStats]:
    """Retrieve all users in the system with their lesson and word mastery statistics."""
    users = db.scalars(select(User).order_by(User.id.asc())).all()

    # Query counts in bulk
    lesson_counts = dict(
        db.execute(
            select(Lesson.user_id, func.count(Lesson.id))
            .group_by(Lesson.user_id)
        ).all()
    )
    word_counts = dict(
        db.execute(
            select(UserWordStats.user_id, func.count(UserWordStats.id))
            .group_by(UserWordStats.user_id)
        ).all()
    )

    results: list[AdminUserStats] = []
    for u in users:
        results.append(
            AdminUserStats(
                id=u.id,
                username=u.username,
                is_admin=getattr(u, "is_admin", False),
                is_active=u.is_active,
                created_at=u.created_at,
                lesson_count=lesson_counts.get(u.id, 0),
                word_count=word_counts.get(u.id, 0),
            )
        )

    return results


@router.get(
    "/logs/journeys",
    response_model=list[JourneyLog],
    summary="Extract user journeys from text log file (Admin only)",
)
def get_log_journeys(
    journey_type: str | None = Query(None, description="Filter by journey type ('word_adding' or 'lesson_creation')"),
    limit: int = Query(50, ge=1, le=200, description="Max journeys to retrieve"),
    admin_user: User = Depends(get_current_admin_user),
) -> list[JourneyLog]:
    """
    Parses the server's text log file directly to extract each journey,
    including timestamps, progress steps, user chunk selections, and LLM input/output.
    """
    return parse_log_file(limit=limit, journey_type_filter=journey_type)
