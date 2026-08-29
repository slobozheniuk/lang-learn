import asyncio
import pytest
from sqlalchemy.orm import Session

from app.crud.job import get_job
from app.crud.lesson import get_lesson_by_id
from app.crud.stats import get_user_word_stats
from app.crud.word import get_word_by_text_and_lang
from app.models.user import User
from app.services.job_queue import JobQueueService
from app.services.llm.mock_provider import MockLLMProvider


@pytest.mark.asyncio
async def test_job_queue_short_text_translation_target_word_only(
    db_session: Session, test_user: User
):
    service = JobQueueService(llm_provider=MockLLMProvider())

    # Submit single word pair
    job, lesson, words = await service.submit_text(
        db=db_session,
        user_id=test_user.id,
        text="ephemeral - мимолетный",
        source_lang="ru",
        target_lang="en",
        wait=True,
    )

    assert job.status == "completed"
    assert lesson is None  # Single word pair should NOT create a lesson
    assert len(words) == 1
    target_w = words[0]
    assert target_w.text == "ephemeral"
    assert target_w.language_code == "en"
    assert target_w.translation == "мимолетный"

    # Verify reverse source word is NOT created in database
    source_w = get_word_by_text_and_lang(db_session, text="мимолетный", language_code="ru")
    assert source_w is None

    # Verify UserWordStats created for target word for immediate deck review
    stats = get_user_word_stats(db_session, user_id=test_user.id, word_id=target_w.id)
    assert stats is not None
    assert stats.user_id == test_user.id
    assert stats.word_id == target_w.id


@pytest.mark.asyncio
async def test_job_queue_duplicate_handling(
    db_session: Session, test_user: User
):
    service = JobQueueService(llm_provider=MockLLMProvider())

    # First submission
    _, _, words1 = await service.submit_text(
        db=db_session,
        user_id=test_user.id,
        text="luminary - светило",
        source_lang="ru",
        target_lang="en",
        wait=True,
    )

    # Second submission with same word
    _, _, words2 = await service.submit_text(
        db=db_session,
        user_id=test_user.id,
        text="luminary - светило",
        source_lang="ru",
        target_lang="en",
        wait=True,
    )

    assert words1[0].id == words2[0].id


def test_count_sentences():
    from app.services.job_queue import count_sentences
    assert count_sentences("") == 0
    assert count_sentences("hello") == 1
    assert count_sentences("hello world") == 1
    assert count_sentences("hello world.") == 1
    assert count_sentences("hello world. How are you?") == 2
    assert count_sentences("First sentence! Second sentence? Third sentence.") == 3
    assert count_sentences("Line 1\nLine 2\nLine 3") == 3


@pytest.mark.asyncio
async def test_job_queue_text_submission_no_auto_lesson(
    db_session: Session, test_user: User
):
    service = JobQueueService(llm_provider=MockLLMProvider())

    multi_sentence_text = "The dog barked loudly. The cat ran away into the cozy house."
    job, lesson, words = await service.submit_text(
        db=db_session,
        user_id=test_user.id,
        text=multi_sentence_text,
        source_lang="ru",
        target_lang="en",
        wait=True,
    )

    assert job.status == "completed"
    assert lesson is None  # Should NOT automatically create a lesson
    assert job.lesson_id is None
    assert len(words) >= 2

    # Check job result_json
    import json
    res = json.loads(job.result_json)
    assert res["is_lesson"] is False
    assert res["is_multi_sentence"] is True
    assert res["can_create_lesson"] is True
    assert len(res["word_ids"]) == len(words)


@pytest.mark.asyncio
async def test_job_queue_async_worker_processing(
    db_session: Session, test_user: User
):
    service = JobQueueService(
        llm_provider=MockLLMProvider(), session_factory=lambda: db_session
    )
    service.start_worker()

    try:
        # Submit with wait=False (queued to worker)
        job, _, _ = await service.submit_text(
            db=db_session,
            user_id=test_user.id,
            text="gezellig - уютный",
            source_lang="ru",
            target_lang="nl",
            wait=False,
        )

        assert job.status == "queued"

        # Wait briefly for worker loop to pick up and process job
        for _ in range(30):
            await asyncio.sleep(0.1)
            updated_job = get_job(db_session, job.id)
            if updated_job and updated_job.status == "completed":
                break

        final_job = get_job(db_session, job.id)
        assert final_job is not None
        assert final_job.status == "completed"
    finally:
        await service.stop_worker()
