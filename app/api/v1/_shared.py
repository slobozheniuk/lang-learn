"""Shared helpers for lesson API endpoints: language resolution, ownership checks,
lesson serialization, and the submit-text flow shared by /words and /lessons routers."""

import json
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud.job import create_job, update_job
from app.crud.lesson import get_lesson_by_id
from app.models.job import Job
from app.models.lesson import Lesson
from app.models.user import User
from app.models.word import Word
from app.schemas.lesson import LessonCreate, LessonRead
from app.schemas.word import WordRead
from app.services.word_service import WordService

# A text with at least this many words becomes a reading lesson instead of flashcards
LESSON_MIN_WORDS = 5


def resolve_language_pair(
    user: User,
    source_lang: str | None,
    target_lang: str | None,
) -> tuple[str, str]:
    """Fall back to the user's active learning profile; 400 if neither is available."""
    profile = user.get_active_profile()
    src = source_lang or (profile.source_language if profile else None)
    tgt = target_lang or (profile.target_language if profile else None)
    if not src or not tgt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active learning profile required or source and target languages must be specified.",
        )
    return src, tgt


def get_owned_lesson(db: Session, lesson_id: int, user: User) -> Lesson:
    """Fetch a lesson and verify it belongs to the user (404 otherwise)."""
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson or lesson.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lesson with id {lesson_id} not found.",
        )
    return lesson


def update_current_user(db: Session, current_user: User, user_in: "UserUpdate") -> "UserRead":
    """Shared PATCH /me logic for the auth and users routers."""
    from app.crud.user import get_user_by_username, update_user
    from app.schemas.user import UserRead

    if user_in.username and user_in.username.strip() != current_user.username:
        existing = get_user_by_username(db, user_in.username)
        if existing and existing.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this username already exists.",
            )
    return UserRead.model_validate(update_user(db, current_user, user_in))


def lesson_words_to_read(lesson: Lesson, user_id: int, db: Session) -> list[WordRead]:
    return WordService.to_read_many(
        [lw.word for lw in lesson.lesson_words if lw.word], user_id, db
    )


def lesson_to_read(lesson: Lesson, user_id: int, db: Session) -> LessonRead:
    """Serialize a Lesson ORM object into LessonRead with its member words."""
    lesson_read = LessonRead.model_validate(lesson)
    lesson_read.words = lesson_words_to_read(lesson, user_id, db)
    return lesson_read


def make_lesson_title(words: list[str], prefix: str = "Lesson") -> str:
    """Build a short lesson title from the first few words of the input text."""
    snippet = " ".join(words[:4])
    if len(words) > 4:
        snippet += "..."
    return f"{prefix}: {snippet}"[:255]


def words_to_quiz_payload(words: list[Word]) -> list[dict]:
    """Shape ORM words into the payload expected by LLMProvider.generate_quiz."""
    return [
        {
            "text": w.text,
            "translation": w.translation,
            "pos": w.pos,
            "phonetic": w.phonetic,
            "context_phrase": w.context_phrase,
        }
        for w in words
    ]


def attach_words_to_lesson(db: Session, lesson_id: int, words: list[Word]) -> None:
    from app.crud.lesson import add_word_to_lesson

    for idx, w in enumerate(words):
        add_word_to_lesson(db, lesson_id=lesson_id, word_id=w.id, order_index=idx)


def create_reading_lesson_with_job(
    db: Session,
    user: User,
    text: str,
    source_lang: str,
    target_lang: str,
    status_after_submit: str,
) -> tuple[Lesson, Job]:
    """Create a reading lesson plus its completed bookkeeping Job for a >=5-word text."""
    from app.services.job_queue import count_sentences

    words_in_text = text.strip().split()
    lesson = _create_lesson(
        db,
        user_id=user.id,
        source_lang=source_lang,
        target_lang=target_lang,
        title=make_lesson_title(words_in_text),
        raw_input=text,
        input_type="reading",
        status=status_after_submit,
    )
    job = create_job(
        db=db,
        user_id=user.id,
        input_text=text,
        source_lang=source_lang,
        target_lang=target_lang,
        type="lesson_generation",
        lesson_id=lesson.id,
    )
    update_job(
        db,
        job_id=job.id,
        status="completed",
        lesson_id=lesson.id,
        result_json=json.dumps(
            {
                "items_count": 0,
                "is_lesson": True,
                "is_multi_sentence": count_sentences(text) > 1,
                "can_create_lesson": True,
                "lesson_id": lesson.id,
                "word_ids": [],
            }
        ),
    )
    return lesson, job


def _create_lesson(
    db: Session,
    user_id: int,
    source_lang: str,
    target_lang: str,
    title: str,
    raw_input: str,
    input_type: str,
    status: str,
    **data,
) -> Lesson:
    from app.crud.lesson import create_lesson as crud_create_lesson

    return crud_create_lesson(
        db,
        user_id=user_id,
        lesson_in=LessonCreate(
            source_lang=source_lang,
            target_lang=target_lang,
            title=title,
            raw_input=raw_input,
            input_type=input_type,
            is_completed=False,
            **data,
        ),
        status=status,
    )
