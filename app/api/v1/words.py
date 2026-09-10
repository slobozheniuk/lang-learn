"""Word endpoints: text submission (flashcards or reading lessons) and word CRUD."""

import json
import logging
import time
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.v1._shared import (
    LESSON_MIN_WORDS,
    create_reading_lesson_with_job,
    lesson_to_read,
)
from app.auth.dependencies import get_current_user
from app.crud.language import get_language_by_code
from app.crud.lesson import get_lesson_by_id
from app.database import SessionLocal, get_db
from app.models.user import User
from app.schemas.job import TextSubmissionRequest, TextSubmissionResponse
from app.schemas.word import WordCreate, WordRead
from app.services.job_queue import count_sentences, job_queue_service
from app.services.journey_logger import log_journey_event
from app.services.nlp import nlp_service
from app.services.word_service import WordService

logger = logging.getLogger("app.api.v1.words")
router = APIRouter()


async def _prepare_lesson_in_background(
    lesson_id: int,
    text: str,
    target_lang: str,
    user_id: int | None = None,
    username: str | None = None,
) -> None:
    """Segment raw text into reading chunks via spaCy + phrasal verb postprocessing."""
    try:
        chunk_response = await nlp_service.chunk_text(
            text=text,
            language_code=target_lang,
            llm=job_queue_service.llm,
        )
        with SessionLocal() as session:
            lesson = get_lesson_by_id(session, lesson_id)
            if lesson:
                lesson.chunk_data = json.dumps(chunk_response.model_dump())
                if chunk_response.title:
                    lesson.title = chunk_response.title[:250]
                lesson.status = "ready"
                session.commit()
                logger.info(f"Background lesson generation ready: lesson_id={lesson_id}, title='{lesson.title}'")
                log_journey_event(
                    journey_id=f"lesson_{lesson_id}",
                    journey_type="lesson_creation",
                    stage="chunking_completed",
                    action="Text Chunking Completed",
                    user_id=user_id,
                    username=username,
                    data={"chunks_count": len(chunk_response.chunks), "title": chunk_response.title, "preview": text[:60]},
                )
    except Exception as e:
        logger.error(f"Error preparing lesson {lesson_id} in background: {e}", exc_info=True)
        with SessionLocal() as session:
            lesson = get_lesson_by_id(session, lesson_id)
            if lesson:
                lesson.status = "failed"
                session.commit()


@router.post(
    "/submit-text",
    response_model=TextSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit text via AI for translation and flashcard / lesson generation",
)
async def submit_text(
    request: TextSubmissionRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TextSubmissionResponse:
    if not request.text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text cannot be empty.")

    profile = current_user.get_active_profile()
    source_lang = request.source_lang or (profile.source_language if profile else "en")
    target_lang = request.target_lang or (profile.target_language if profile else "en")

    word_count = len(request.text.strip().split())
    sentence_count = count_sentences(request.text)

    # Long texts (>= 5 words) become reading lessons chunked in the background
    if word_count >= LESSON_MIN_WORDS:
        lesson, job = create_reading_lesson_with_job(
            db,
            user=current_user,
            text=request.text,
            source_lang=source_lang,
            target_lang=target_lang,
            status_after_submit="processing",
        )
        log_journey_event(
            journey_id=f"lesson_{lesson.id}",
            journey_type="lesson_creation",
            stage="text_submitted",
            action="Lesson Text Submitted",
            user_id=current_user.id,
            username=current_user.username,
            data={"text": request.text, "word_count": word_count, "lesson_id": lesson.id},
        )
        background_tasks.add_task(
            _prepare_lesson_in_background,
            lesson_id=lesson.id,
            text=request.text,
            target_lang=target_lang,
            user_id=current_user.id,
            username=current_user.username,
        )
        return TextSubmissionResponse(
            job_id=job.id,
            status=job.status,
            is_lesson=True,
            is_multi_sentence=sentence_count > 1,
            sentence_count=sentence_count,
            word_count=word_count,
            can_create_lesson=True,
            lesson_in_progress=True,
            lesson=lesson_to_read(lesson, current_user.id, db),
            words=[],
            error_message=None,
        )

    # Short texts: extract vocabulary words straight into the user's SRS deck
    journey_id = f"word_submit_{current_user.id}_{int(time.time() * 1000)}"
    log_journey_event(
        journey_id=journey_id,
        journey_type="word_adding",
        stage="text_submitted",
        action="Text Submitted for Word Addition",
        user_id=current_user.id,
        username=current_user.username,
        data={"text": request.text, "word_count": word_count},
    )

    job, _, words = await job_queue_service.submit_text(
        db=db,
        user_id=current_user.id,
        text=request.text,
        source_lang=source_lang,
        target_lang=target_lang,
        wait=request.wait,
    )

    log_journey_event(
        journey_id=journey_id,
        journey_type="word_adding",
        stage="words_created",
        action="Words Added to Vocabulary",
        user_id=current_user.id,
        username=current_user.username,
        data={"words": [w.text for w in words], "count": len(words)},
    )

    return TextSubmissionResponse(
        job_id=job.id,
        status=job.status,
        is_lesson=False,
        is_multi_sentence=False,
        sentence_count=sentence_count,
        word_count=word_count,
        can_create_lesson=False,
        lesson_in_progress=False,
        lesson=None,
        words=WordService.to_read_many(words, current_user.id, db),
        error_message=job.error_message,
    )


@router.post(
    "/",
    response_model=WordRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create or retrieve a word",
)
def create_word(
    word_in: WordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WordRead:
    if not get_language_by_code(db, word_in.language_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Language '{word_in.language_code}' does not exist.",
        )

    word = WordService.create_word(db, word_in, user_id=current_user.id)
    word_read = WordService.get_word(db, word.id, user_id=current_user.id)
    if not word_read:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve created word",
        )

    log_journey_event(
        journey_id=f"word_create_{current_user.id}_{word.id}",
        journey_type="word_adding",
        stage="word_created",
        action="Word Created Manually",
        user_id=current_user.id,
        username=current_user.username,
        data={"word": word_in.text, "translation": word_in.translation, "language": word_in.language_code},
    )
    return word_read


@router.get("/", response_model=list[WordRead], summary="List words with optional filters")
def list_words(
    language_code: str | None = Query(None, description="Filter by language code (e.g. 'en', 'nl')"),
    search: str | None = Query(None, description="Search by text, lemma, or translation"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WordRead]:
    profile = current_user.get_active_profile()
    lang = language_code or (profile.target_language if profile else None)
    return WordService.list_words(
        db,
        language_code=lang,
        search=search,
        skip=skip,
        limit=limit,
        user_id=current_user.id,
    )


@router.get("/{word_id}", response_model=WordRead, summary="Get single word details")
def get_word(
    word_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WordRead:
    word = WordService.get_word(db, word_id, user_id=current_user.id)
    if not word:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Word with id {word_id} not found",
        )
    return word


@router.delete("/{word_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a word")
def delete_word(
    word_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not WordService.delete_word(db, word_id, user_id=current_user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Word with id {word_id} not found",
        )
