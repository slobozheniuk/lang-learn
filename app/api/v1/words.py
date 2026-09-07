import json
import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_optional_current_user
from app.crud.language import get_language_by_code
from app.crud.lesson import add_word_to_lesson, create_lesson, get_lesson_by_id
from app.database import SessionLocal, get_db
from app.models.user import User
from app.schemas.job import TextSubmissionRequest, TextSubmissionResponse
from app.schemas.lesson import LessonCreate, LessonRead
from app.schemas.word import WordCreate, WordRead
from app.services.job_queue import count_sentences, job_queue_service
from app.services.nlp import nlp_service
from app.services.word_service import WordService

logger = logging.getLogger("app.api.v1.words")
router = APIRouter()


async def _prepare_lesson_in_background(
    lesson_id: int,
    text: str,
    source_lang: str,
    target_lang: str,
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text cannot be empty.",
        )

    # Always extract vocabulary words & flashcards for SRS study
    job, _, words = await job_queue_service.submit_text(
        db=db,
        user_id=current_user.id,
        text=request.text,
        source_lang=request.source_lang,
        target_lang=request.target_lang,
        wait=request.wait,
    )

    words_in_text = request.text.strip().split()
    word_count = len(words_in_text)
    sentence_count = count_sentences(request.text)
    should_create_lesson = word_count >= 5

    words_read = [
        WordService.to_read(w, user_id=current_user.id, db=db)
        for w in words
    ]

    lesson_read = None
    if should_create_lesson:
        snippet = " ".join(words_in_text[:4])
        if len(words_in_text) > 4:
            snippet += "..."
        lesson_title = f"Lesson: {snippet}"
        if len(lesson_title) > 250:
            lesson_title = lesson_title[:250]

        lesson_in = LessonCreate(
            source_lang=request.source_lang,
            target_lang=request.target_lang,
            title=lesson_title,
            raw_input=request.text,
            input_type="reading",
            is_completed=False,
        )
        created_lesson = create_lesson(db, user_id=current_user.id, lesson_in=lesson_in, status="processing")
        for idx, w in enumerate(words):
            add_word_to_lesson(db, lesson_id=created_lesson.id, word_id=w.id, order_index=idx)
        db.commit()
        db.refresh(created_lesson)

        # Queue background chunking
        background_tasks.add_task(
            _prepare_lesson_in_background,
            lesson_id=created_lesson.id,
            text=request.text,
            source_lang=request.source_lang,
            target_lang=request.target_lang,
        )

        lesson_words = [WordService.to_read(w, user_id=current_user.id, db=db) for w in words]
        lesson_read = LessonRead(
            id=created_lesson.id,
            user_id=created_lesson.user_id,
            source_lang=created_lesson.source_lang,
            target_lang=created_lesson.target_lang,
            title=created_lesson.title,
            raw_input=created_lesson.raw_input,
            input_type=created_lesson.input_type,
            status=created_lesson.status,
            created_at=created_lesson.created_at,
            updated_at=created_lesson.updated_at,
            words=lesson_words,
        )

    return TextSubmissionResponse(
        job_id=job.id,
        status=job.status,
        is_lesson=should_create_lesson,
        is_multi_sentence=sentence_count > 1,
        sentence_count=sentence_count,
        word_count=word_count,
        can_create_lesson=should_create_lesson,
        lesson_in_progress=should_create_lesson,
        lesson=lesson_read,
        words=words_read,
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
    # Ensure language exists
    lang = get_language_by_code(db, word_in.language_code)
    if not lang:
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
    active_profile = current_user.get_active_profile()
    lang = (
        language_code
        or (active_profile.target_language if active_profile else None)
    )
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
    deleted = WordService.delete_word(db, word_id, user_id=current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Word with id {word_id} not found",
        )
