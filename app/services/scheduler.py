import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.lesson import add_word_to_lesson, create_lesson
from app.database import SessionLocal
from app.models.lesson import Lesson
from app.models.user import User
from app.models.user_word_stats import UserWordStats
from app.models.word import Word
from app.schemas.lesson import LessonCreate
from app.services.llm.base import LLMProvider
from app.services.llm.factory import get_llm_provider

logger = logging.getLogger("app.services.scheduler")


async def check_and_generate_revision_quiz_for_user(
    db: Session,
    user: User,
    llm_provider: LLMProvider | None = None,
    now: datetime | None = None,
) -> Lesson | None:
    """
    Check if a user qualifies for a nightly revision quiz:
    1. All existing lessons are completed (or user has no incomplete lessons).
    2. No lessons have been created in the last 24 hours.
    3. User has words due/overdue in SM-2 spaced repetition.
    If all conditions hold, generate a revision quiz lesson using these due words.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    elif now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    # 1. Query all lessons for the user
    lessons = list(
        db.scalars(
            select(Lesson)
            .where(Lesson.user_id == user.id)
            .order_by(Lesson.created_at.desc())
        ).all()
    )

    # Condition 1: Check if all existing lessons are completed
    if lessons:
        all_completed = all(l.is_completed or l.status == "completed" for l in lessons)
        if not all_completed:
            logger.info(f"User {user.id} has incomplete lessons; skipping revision quiz.")
            return None

    # Condition 2: Check if any lesson was created in the last 24 hours
    cutoff_24h = now - timedelta(hours=24)
    for l in lessons:
        l_created = l.created_at
        if l_created.tzinfo is None:
            l_created = l_created.replace(tzinfo=timezone.utc)
        if l_created >= cutoff_24h:
            logger.info(f"User {user.id} had a lesson created within 24h ({l_created}); skipping revision quiz.")
            return None

    # Condition 3: Check if the user has words due/overdue in SM-2 spaced repetition
    due_stmt = (
        select(Word)
        .join(UserWordStats, UserWordStats.word_id == Word.id)
        .where(
            UserWordStats.user_id == user.id,
            UserWordStats.next_review_at <= now,
        )
        .order_by(UserWordStats.next_review_at.asc())
        .limit(20)
    )
    due_words = list(db.scalars(due_stmt).all())

    if not due_words:
        logger.info(f"User {user.id} has no due/overdue words in SM-2; skipping revision quiz.")
        return None

    # Generate revision quiz
    if llm_provider is None:
        llm_provider = get_llm_provider()

    target_lang = (
        getattr(user, "target_language", None)
        or getattr(user, "default_target_lang", None)
        or due_words[0].language_code
        or "en"
    )
    source_lang = (
        getattr(user, "native_language", None)
        or getattr(user, "default_source_lang", None)
        or "ru"
    )

    words_data = [
        {
            "text": w.text,
            "translation": w.translation,
            "pos": w.pos,
            "phonetic": w.phonetic,
            "context_phrase": w.context_phrase,
        }
        for w in due_words
    ]

    quiz_title = f"Revision Quiz - {now.strftime('%b %d, %Y')}"
    quiz_response = await llm_provider.generate_quiz(
        words=words_data,
        source_lang=source_lang,
        target_lang=target_lang,
        title=quiz_title,
    )

    lesson_in = LessonCreate(
        source_lang=source_lang,
        target_lang=target_lang,
        title=quiz_response.title or quiz_title,
        raw_input=f"Nightly revision for {len(due_words)} due words",
        input_type="revision",
        quiz_data=quiz_response.model_dump(),
        is_completed=False,
    )
    lesson = create_lesson(db, user_id=user.id, lesson_in=lesson_in, status="ready")

    for idx, w in enumerate(due_words):
        add_word_to_lesson(db, lesson_id=lesson.id, word_id=w.id, order_index=idx)

    logger.info(
        f"Generated nightly revision quiz lesson for user {user.id}: lesson_id={lesson.id}, title='{lesson.title}', due_words_count={len(due_words)}"
    )
    return lesson


async def run_nightly_revision_check(
    db: Session,
    llm_provider: LLMProvider | None = None,
    now: datetime | None = None,
) -> list[Lesson]:
    """Run revision check across all active users."""
    users = list(db.scalars(select(User).where(User.is_active == True)).all())
    created: list[Lesson] = []
    for user in users:
        try:
            lesson = await check_and_generate_revision_quiz_for_user(
                db, user, llm_provider=llm_provider, now=now
            )
            if lesson:
                created.append(lesson)
        except Exception as e:
            logger.error(f"Error during nightly revision check for user {user.id}: {e}", exc_info=True)
    return created


async def check_and_generate_revision_quizzes(
    db: Session,
    llm_provider: LLMProvider | None = None,
    now: datetime | None = None,
) -> list[Lesson]:
    """Check and generate nightly revision quizzes for qualifying users."""
    return await run_nightly_revision_check(db=db, llm_provider=llm_provider, now=now)


class SchedulerService:
    """Background scheduler service for periodic maintenance tasks (nightly revision quizzes)."""

    def __init__(
        self,
        session_factory: Any = None,
        check_interval_seconds: int = 3600,
        llm_provider: LLMProvider | None = None,
    ):
        self._session_factory = session_factory or SessionLocal
        self.check_interval_seconds = check_interval_seconds
        self.worker_task: asyncio.Task | None = None
        self._is_running = False
        self._llm_provider = llm_provider

    def set_llm_provider(self, provider: LLMProvider) -> None:
        self._llm_provider = provider

    def set_session_factory(self, factory: Any) -> None:
        self._session_factory = factory

    def start(self) -> None:
        if self.worker_task is None or self.worker_task.done():
            self._is_running = True
            try:
                loop = asyncio.get_running_loop()
                self.worker_task = loop.create_task(self._loop())
                logger.info("Scheduler service worker loop started.")
            except RuntimeError:
                pass

    async def stop(self) -> None:
        self._is_running = False
        if self.worker_task and not self.worker_task.done():
            self.worker_task.cancel()
            try:
                await self.worker_task
            except asyncio.CancelledError:
                pass
            logger.info("Scheduler service worker stopped.")

    async def run_once(self, now: datetime | None = None) -> list[Lesson]:
        with self._session_factory() as db:
            return await run_nightly_revision_check(db, llm_provider=self._llm_provider, now=now)

    async def check_and_generate_revision_quizzes(self, now: datetime | None = None) -> list[Lesson]:
        """Convenience method to run the nightly revision check."""
        return await self.run_once(now=now)

    async def _loop(self) -> None:
        while self._is_running:
            try:
                await self.run_once()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in scheduler background loop: {e}", exc_info=True)
            await asyncio.sleep(self.check_interval_seconds)


scheduler_service = SchedulerService()
