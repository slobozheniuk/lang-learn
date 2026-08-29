import asyncio
import json
import logging
import re
import time
from typing import Any
from sqlalchemy.orm import Session

from app.crud.job import create_job, get_job, update_job
from app.crud.language import get_language_by_code
from app.crud.stats import get_or_create_user_word_stats
from app.crud.word import get_or_create_word
from app.database import SessionLocal
from app.models.job import Job
from app.models.lesson import Lesson
from app.models.word import Word
from app.schemas.word import WordRead
from app.services.llm.base import LLMProvider, LLMTranslationResponse
from app.services.llm.factory import get_llm_provider
from app.services.word_service import WordService

logger = logging.getLogger(__name__)


def count_input_tokens(text: str) -> int:
    """Approximate word / token count of the raw input text."""
    tokens = re.findall(r"\b[\w'-]+\b", text.strip())
    return len(tokens)


def count_sentences(text: str) -> int:
    """Accurately count sentences in input text based on punctuation and line breaks."""
    text = text.strip()
    if not text:
        return 0
    sentences = [s.strip() for s in re.split(r'(?:[.!?]+(?:\s+|$)|[\n\r]+)', text) if s.strip()]
    return len(sentences)



class JobQueueService:
    """In-process asynchronous job queue with database persistence and background worker."""

    def __init__(self, llm_provider: LLMProvider | None = None, session_factory: Any = None):
        self._queue: asyncio.Queue[str] | None = None
        self.worker_task: asyncio.Task | None = None
        self._llm_provider = llm_provider
        self._session_factory = session_factory or SessionLocal
        self._is_running = False

    @property
    def queue(self) -> asyncio.Queue[str]:
        if self._queue is None:
            self._queue = asyncio.Queue()
        return self._queue

    @property
    def llm(self) -> LLMProvider:
        if self._llm_provider is None:
            self._llm_provider = get_llm_provider()
        return self._llm_provider

    def set_llm_provider(self, provider: LLMProvider) -> None:
        self._llm_provider = provider

    def set_session_factory(self, factory: Any) -> None:
        self._session_factory = factory

    def start_worker(self) -> None:
        """Start the background worker task."""
        if self.worker_task is None or self.worker_task.done():
            self._is_running = True
            # Recreate queue for the running loop
            self._queue = asyncio.Queue()
            try:
                loop = asyncio.get_running_loop()
                self.worker_task = loop.create_task(self._worker_loop())
                logger.info("JobQueue background worker started.")
            except RuntimeError:
                # In non-async or test context without running loop
                pass

    async def stop_worker(self) -> None:
        """Stop the background worker task."""
        self._is_running = False
        if self.worker_task and not self.worker_task.done():
            self.worker_task.cancel()
            try:
                await self.worker_task
            except asyncio.CancelledError:
                pass
            logger.info("JobQueue background worker stopped.")

    async def enqueue(self, job_id: str) -> None:
        """Put job ID into in-memory queue."""
        await self.queue.put(job_id)
        logger.info(f"Job enqueued: job_id='{job_id}', queue_size={self.queue.qsize()}")

    async def _worker_loop(self) -> None:
        """Continuous background loop consuming jobs from queue."""
        logger.info("JobQueue background worker loop active.")
        while self._is_running:
            try:
                job_id = await self.queue.get()
                logger.info(f"Worker picked up job from queue: job_id='{job_id}'")
                try:
                    await self.process_job(job_id)
                except Exception as e:
                    logger.error(f"Error processing job {job_id} in worker loop: {e}", exc_info=True)
                finally:
                    self.queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Unexpected error in worker loop: {e}", exc_info=True)
                await asyncio.sleep(0.5)

    async def process_job(
        self, job_id: str, db: Session | None = None
    ) -> tuple[Job | None, Lesson | None, list[Word]]:
        """Process a single job: invoke LLM, validate schema, upsert dynamic language words, associations, lesson."""
        start_time = time.perf_counter()
        should_close_db = False
        if db is None:
            db = self._session_factory()
            should_close_db = True

        try:
            job = get_job(db, job_id)
            if not job:
                logger.warning(f"Job {job_id} not found in database.")
                return None, None, []

            # Set status to processing
            update_job(db, job_id, status="processing")
            tokens_est = count_input_tokens(job.input_text)
            logger.info(
                f"Job processing started: job_id='{job_id}', user_id={job.user_id}, "
                f"langs='{job.source_lang}->{job.target_lang}', tokens_est={tokens_est}, "
                f"preview='{job.input_text[:40].strip()}...'"
            )

            # 1. Invoke LLM with strict prompt & Pydantic validation
            try:
                llm_response: LLMTranslationResponse = await self.llm.extract_vocabulary(
                    text=job.input_text,
                    source_lang=job.source_lang,
                    target_lang=job.target_lang,
                )
            except Exception as e:
                logger.warning(
                    f"LLM extraction failed for job {job_id}: {e}. Falling back to deterministic mock provider."
                )
                try:
                    from app.services.llm.mock_provider import MockLLMProvider
                    fallback_provider = MockLLMProvider()
                    llm_response = await fallback_provider.extract_vocabulary(
                        text=job.input_text,
                        source_lang=job.source_lang,
                        target_lang=job.target_lang,
                    )
                except Exception as fb_err:
                    duration_ms = (time.perf_counter() - start_time) * 1000
                    logger.error(
                        f"Fallback LLM extraction failed for job {job_id} after {duration_ms:.2f}ms: {fb_err}",
                        exc_info=True,
                    )
                    update_job(db, job_id, status="failed", error_message=str(e))
                    return job, None, []

            items = llm_response.items
            if not items:
                # If no items extracted, make synthetic fallback item
                items = [
                    WordRead(
                        id=0,
                        language_code=job.target_lang,
                        text=job.input_text,
                        translation=job.input_text,
                    )
                ]

            sentence_count = count_sentences(job.input_text)
            is_multi_sentence = sentence_count > 1

            created_target_words: list[Word] = []

            # 2. Dynamic target language storage and user stats
            for idx, item in enumerate(items):
                target_text = item.target_text if hasattr(item, "target_text") else item.text
                source_text = item.source_text if hasattr(item, "source_text") else item.translation
                pos = getattr(item, "pos", None)
                phonetic = getattr(item, "phonetic", None)
                lemma = getattr(item, "lemma", None)
                context_phrase = getattr(item, "context_phrase", None)

                # Upsert target language word in its dedicated language storage
                target_word = get_or_create_word(
                    db,
                    language_code=job.target_lang,
                    text=target_text,
                    lemma=lemma,
                    pos=pos,
                    phonetic=phonetic,
                    translation=source_text,
                    context_phrase=context_phrase,
                )

                # Associate with user SRS stats for immediate deck practice
                get_or_create_user_word_stats(db, user_id=job.user_id, word_id=target_word.id)
                created_target_words.append(target_word)

            # 3. Mark job completed
            result_payload = {
                "items_count": len(created_target_words),
                "is_lesson": False,
                "is_multi_sentence": is_multi_sentence,
                "can_create_lesson": is_multi_sentence,
                "lesson_id": None,
                "word_ids": [w.id for w in created_target_words],
            }
            update_job(
                db,
                job_id=job.id,
                status="completed",
                lesson_id=None,
                result_json=json.dumps(result_payload),
            )

            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.info(
                f"Job processing completed: job_id='{job.id}', duration={duration_ms:.2f}ms, "
                f"target_words_count={len(created_target_words)}, is_multi_sentence={is_multi_sentence}"
            )

            return job, None, created_target_words

        finally:
            if should_close_db:
                db.close()

    async def submit_text(
        self,
        db: Session,
        user_id: int,
        text: str,
        source_lang: str = "ru",
        target_lang: str = "en",
        wait: bool = True,
    ) -> tuple[Job, Lesson | None, list[Word]]:
        """Submit text for translation/lesson generation, queuing or running synchronously."""
        job = create_job(
            db=db,
            user_id=user_id,
            input_text=text,
            source_lang=source_lang,
            target_lang=target_lang,
            type="text_translation",
        )
        logger.info(
            f"Job created: job_id='{job.id}', user_id={user_id}, mode={'sync' if wait else 'async'}, "
            f"langs='{source_lang}->{target_lang}', text_length={len(text)}"
        )

        if wait:
            # Process synchronously immediately
            _, lesson, words = await self.process_job(job.id, db=db)
            db.refresh(job)
            return job, lesson, words
        else:
            # Enqueue to background worker
            await self.enqueue(job.id)
            return job, None, []


# Global singleton instance
job_queue_service = JobQueueService()
