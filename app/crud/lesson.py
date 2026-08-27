from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.lesson import Lesson
from app.schemas.lesson import LessonCreate


def get_lesson_by_id(db: Session, lesson_id: int) -> Lesson | None:
    return db.scalar(select(Lesson).where(Lesson.id == lesson_id))


def get_user_lessons(
    db: Session, user_id: int, skip: int = 0, limit: int = 20
) -> list[Lesson]:
    return list(
        db.scalars(
            select(Lesson)
            .where(Lesson.user_id == user_id)
            .order_by(Lesson.id.desc())
            .offset(skip)
            .limit(limit)
        ).all()
    )


def create_lesson(db: Session, user_id: int, lesson_in: LessonCreate) -> Lesson:
    lesson = Lesson(
        user_id=user_id,
        source_lang=lesson_in.source_lang.lower().strip(),
        target_lang=lesson_in.target_lang.lower().strip(),
        title=lesson_in.title.strip(),
        raw_input=lesson_in.raw_input,
        input_type=lesson_in.input_type.lower().strip(),
        status="pending",
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson
