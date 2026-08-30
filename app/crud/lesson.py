import json
import logging
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.lesson import Lesson
from app.models.lesson_word import LessonWord
from app.models.word import Word
from app.schemas.lesson import LessonCreate


def get_lesson_by_id(db: Session, lesson_id: int) -> Lesson | None:
    return db.scalar(
        select(Lesson)
        .options(joinedload(Lesson.lesson_words).joinedload(LessonWord.word))
        .where(Lesson.id == lesson_id)
    )


def get_user_lessons(
    db: Session,
    user_id: int,
    source_lang: str | None = None,
    target_lang: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[Lesson]:
    stmt = (
        select(Lesson)
        .options(joinedload(Lesson.lesson_words).joinedload(LessonWord.word))
        .where(Lesson.user_id == user_id)
    )
    if source_lang:
        stmt = stmt.where(Lesson.source_lang == source_lang.lower().strip())
    if target_lang:
        stmt = stmt.where(Lesson.target_lang == target_lang.lower().strip())
    stmt = stmt.order_by(Lesson.id.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).unique().all())


def create_lesson(
    db: Session,
    user_id: int,
    lesson_in: LessonCreate,
    status: str = "pending",
) -> Lesson:
    quiz_str = None
    if lesson_in.quiz_data is not None:
        if isinstance(lesson_in.quiz_data, str):
            quiz_str = lesson_in.quiz_data
        else:
            quiz_str = json.dumps(lesson_in.quiz_data)

    chunk_str = None
    if getattr(lesson_in, "chunk_data", None) is not None:
        if isinstance(lesson_in.chunk_data, str):
            chunk_str = lesson_in.chunk_data
        else:
            chunk_str = json.dumps(lesson_in.chunk_data)

    lesson = Lesson(
        user_id=user_id,
        source_lang=lesson_in.source_lang.lower().strip(),
        target_lang=lesson_in.target_lang.lower().strip(),
        title=lesson_in.title.strip(),
        raw_input=lesson_in.raw_input,
        input_type=lesson_in.input_type.lower().strip(),
        status=status,
        quiz_data=quiz_str,
        chunk_data=chunk_str,
        is_completed=lesson_in.is_completed,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson


def add_word_to_lesson(
    db: Session, lesson_id: int, word_id: int, order_index: int = 0
) -> LessonWord:
    existing = db.scalar(
        select(LessonWord).where(
            LessonWord.lesson_id == lesson_id,
            LessonWord.word_id == word_id,
        )
    )
    if existing:
        return existing

    lw = LessonWord(
        lesson_id=lesson_id,
        word_id=word_id,
        order_index=order_index,
    )
    db.add(lw)
    db.commit()
    db.refresh(lw)
    return lw


def get_lesson_words(db: Session, lesson_id: int) -> list[Word]:
    stmt = (
        select(Word)
        .join(LessonWord, LessonWord.word_id == Word.id)
        .where(LessonWord.lesson_id == lesson_id)
        .order_by(LessonWord.order_index.asc())
    )
    return list(db.scalars(stmt).all())


def update_lesson_status(db: Session, lesson_id: int, status: str) -> Lesson | None:
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson:
        return None
    lesson.status = status
    db.commit()
    db.refresh(lesson)
    return lesson


def delete_lesson(db: Session, lesson_id: int, user_id: int | None = None) -> bool:
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson:
        logging.getLogger("app.crud.lesson").warning(
            f"Lesson deletion failed: id={lesson_id} not found."
        )
        return False

    if user_id is not None and lesson.user_id != user_id:
        logging.getLogger("app.crud.lesson").warning(
            f"Lesson deletion failed: lesson_id={lesson_id} does not belong to user_id={user_id}."
        )
        return False

    db.delete(lesson)
    db.commit()
    logging.getLogger("app.crud.lesson").info(
        f"Lesson deleted: id={lesson_id}, user_id={user_id}"
    )
    return True

