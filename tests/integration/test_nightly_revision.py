import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.crud.lesson import create_lesson
from app.crud.stats import get_or_create_user_word_stats
from app.crud.word import get_or_create_word
from app.models.lesson import Lesson
from app.models.user import User
from app.schemas.lesson import LessonCreate
from app.services.llm.mock_provider import MockLLMProvider
from app.services.scheduler import check_and_generate_revision_quiz_for_user, run_nightly_revision_check


@pytest.mark.asyncio
async def test_nightly_revision_success(db_session: Session, test_user: User):
    llm = MockLLMProvider()
    now = datetime.now(timezone.utc)

    # 1. Create an old completed lesson (48 hours ago)
    old_time = now - timedelta(hours=48)
    lesson_in = LessonCreate(
        source_lang="ru",
        target_lang="en",
        title="Old Lesson",
        raw_input="Old vocabulary text",
        input_type="text",
        is_completed=True,
    )
    old_lesson = create_lesson(db_session, user_id=test_user.id, lesson_in=lesson_in, status="completed")
    old_lesson.created_at = old_time
    old_lesson.is_completed = True
    db_session.commit()

    # 2. Create target words with due review stats (next_review_at in the past)
    w1 = get_or_create_word(db_session, language_code="en", text="sun", translation="солнце")
    w2 = get_or_create_word(db_session, language_code="en", text="moon", translation="луна")
    stats1 = get_or_create_user_word_stats(db_session, user_id=test_user.id, word_id=w1.id)
    stats2 = get_or_create_user_word_stats(db_session, user_id=test_user.id, word_id=w2.id)

    stats1.next_review_at = now - timedelta(hours=2)
    stats2.next_review_at = now - timedelta(hours=1)
    db_session.commit()

    # 3. Run nightly revision check
    generated_lesson = await check_and_generate_revision_quiz_for_user(
        db=db_session,
        user=test_user,
        llm_provider=llm,
        now=now,
    )

    assert generated_lesson is not None
    assert generated_lesson.input_type == "revision"
    assert "Revision Quiz" in generated_lesson.title
    assert generated_lesson.status == "ready"
    assert generated_lesson.quiz_data is not None
    assert len(generated_lesson.lesson_words) >= 2


@pytest.mark.asyncio
async def test_nightly_revision_skipped_if_incomplete_lesson_exists(db_session: Session, test_user: User):
    llm = MockLLMProvider()
    now = datetime.now(timezone.utc)

    # Incomplete lesson created 48h ago
    old_time = now - timedelta(hours=48)
    lesson_in = LessonCreate(
        source_lang="ru",
        target_lang="en",
        title="Unfinished Lesson",
        raw_input="Some text",
        input_type="text",
        is_completed=False,
    )
    incomplete_lesson = create_lesson(db_session, user_id=test_user.id, lesson_in=lesson_in, status="ready")
    incomplete_lesson.created_at = old_time
    incomplete_lesson.is_completed = False
    db_session.commit()

    # Create due words
    w = get_or_create_word(db_session, language_code="en", text="book", translation="книга")
    stats = get_or_create_user_word_stats(db_session, user_id=test_user.id, word_id=w.id)
    stats.next_review_at = now - timedelta(hours=5)
    db_session.commit()

    # Revision check should return None
    res = await check_and_generate_revision_quiz_for_user(
        db=db_session,
        user=test_user,
        llm_provider=llm,
        now=now,
    )
    assert res is None


@pytest.mark.asyncio
async def test_nightly_revision_skipped_if_recent_lesson_created_within_24h(db_session: Session, test_user: User):
    llm = MockLLMProvider()
    now = datetime.now(timezone.utc)

    # Lesson created 5 hours ago (completed)
    recent_time = now - timedelta(hours=5)
    lesson_in = LessonCreate(
        source_lang="ru",
        target_lang="en",
        title="Recent Lesson",
        raw_input="Recent text",
        input_type="text",
        is_completed=True,
    )
    recent_lesson = create_lesson(db_session, user_id=test_user.id, lesson_in=lesson_in, status="completed")
    recent_lesson.created_at = recent_time
    recent_lesson.is_completed = True
    db_session.commit()

    # Due words exist
    w = get_or_create_word(db_session, language_code="en", text="house", translation="дом")
    stats = get_or_create_user_word_stats(db_session, user_id=test_user.id, word_id=w.id)
    stats.next_review_at = now - timedelta(hours=5)
    db_session.commit()

    # Should return None because a lesson was created < 24h ago
    res = await check_and_generate_revision_quiz_for_user(
        db=db_session,
        user=test_user,
        llm_provider=llm,
        now=now,
    )
    assert res is None


@pytest.mark.asyncio
async def test_nightly_revision_skipped_if_no_due_words(db_session: Session, test_user: User):
    llm = MockLLMProvider()
    now = datetime.now(timezone.utc)

    # Old completed lesson
    old_time = now - timedelta(hours=48)
    lesson_in = LessonCreate(
        source_lang="ru",
        target_lang="en",
        title="Old Done Lesson",
        raw_input="Some old text",
        input_type="text",
        is_completed=True,
    )
    old_lesson = create_lesson(db_session, user_id=test_user.id, lesson_in=lesson_in, status="completed")
    old_lesson.created_at = old_time
    old_lesson.is_completed = True

    # Word scheduled for future review (not due yet)
    w = get_or_create_word(db_session, language_code="en", text="dog", translation="собака")
    stats = get_or_create_user_word_stats(db_session, user_id=test_user.id, word_id=w.id)
    stats.next_review_at = now + timedelta(days=3)
    db_session.commit()

    res = await check_and_generate_revision_quiz_for_user(
        db=db_session,
        user=test_user,
        llm_provider=llm,
        now=now,
    )
    assert res is None


@pytest.mark.asyncio
async def test_run_nightly_revision_check_all_users(db_session: Session, test_user: User):
    llm = MockLLMProvider()
    now = datetime.now(timezone.utc)

    # Setup qualifying state
    old_time = now - timedelta(hours=50)
    lesson_in = LessonCreate(
        source_lang="ru",
        target_lang="en",
        title="Old Done Lesson",
        raw_input="Some text",
        input_type="text",
        is_completed=True,
    )
    old_lesson = create_lesson(db_session, user_id=test_user.id, lesson_in=lesson_in, status="completed")
    old_lesson.created_at = old_time
    old_lesson.is_completed = True

    w = get_or_create_word(db_session, language_code="en", text="apple", translation="яблоко")
    stats = get_or_create_user_word_stats(db_session, user_id=test_user.id, word_id=w.id)
    stats.next_review_at = now - timedelta(hours=10)
    db_session.commit()

    created_lessons = await run_nightly_revision_check(db=db_session, llm_provider=llm, now=now)
    assert len(created_lessons) >= 1
    assert created_lessons[0].input_type == "revision"
