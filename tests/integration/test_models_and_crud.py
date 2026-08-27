import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.crud.lesson import create_lesson, get_lesson_by_id, get_user_lessons
from app.crud.stats import get_due_words, upsert_user_word_stats
from app.models.lesson import Lesson
from app.models.user import User
from app.models.word import Word
from app.schemas.lesson import LessonCreate
from app.srs.models import CardState


def test_lesson_crud_and_relationships(db_session: Session, test_user: User):
    lesson_in = LessonCreate(
        source_lang="ru",
        target_lang="en",
        title="My First English Lesson",
        raw_input="The quick brown fox jumps over the lazy dog.",
        input_type="text",
    )
    lesson = create_lesson(db_session, user_id=test_user.id, lesson_in=lesson_in)
    assert lesson.id is not None
    assert lesson.title == "My First English Lesson"
    assert lesson.status == "pending"
    assert lesson.user_id == test_user.id

    fetched = get_lesson_by_id(db_session, lesson.id)
    assert fetched is not None
    assert fetched.title == lesson.title
    assert fetched.user.username == test_user.username

    user_lessons = get_user_lessons(db_session, test_user.id)
    assert len(user_lessons) == 1
    assert user_lessons[0].id == lesson.id


def test_user_word_stats_unique_constraint(
    db_session: Session, test_user: User, sample_words: list[Word]
):
    word = sample_words[0]
    state1 = CardState(repetition_number=1, interval_days=1.0, ease_factor=2.5)
    stats1 = upsert_user_word_stats(db_session, test_user.id, word.id, state1)
    assert stats1.id is not None

    state2 = CardState(repetition_number=2, interval_days=6.0, ease_factor=2.5)
    stats2 = upsert_user_word_stats(db_session, test_user.id, word.id, state2)

    # Upsert should update the same row, not duplicate
    assert stats2.id == stats1.id
    assert stats2.repetition_number == 2
    assert stats2.interval_days == 6.0
