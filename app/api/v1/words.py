from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_optional_current_user
from app.crud.language import get_language_by_code
from app.database import get_db
from app.models.user import User
from app.schemas.job import TextSubmissionRequest, TextSubmissionResponse
from app.schemas.lesson import LessonRead
from app.schemas.word import WordCreate, WordRead
from app.services.job_queue import count_sentences, job_queue_service
from app.services.word_service import WordService

router = APIRouter()


@router.post(
    "/submit-text",
    response_model=TextSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit text via AI for translation and flashcard / lesson generation",
)
async def submit_text(
    request: TextSubmissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TextSubmissionResponse:
    if not request.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text cannot be empty.",
        )

    active_profile = current_user.get_active_profile()
    source_lang = (
        request.source_lang
        or (active_profile.source_language if active_profile else None)
        or getattr(current_user, "native_language", None)
        or getattr(current_user, "default_source_lang", None)
        or "ru"
    )
    target_lang = (
        request.target_lang
        or (active_profile.target_language if active_profile else None)
        or getattr(current_user, "target_language", None)
        or getattr(current_user, "default_target_lang", None)
        or "en"
    )

    job, lesson, words = await job_queue_service.submit_text(
        db=db,
        user_id=current_user.id,
        text=request.text,
        source_lang=source_lang,
        target_lang=target_lang,
        wait=request.wait,
    )

    sentence_count = count_sentences(request.text)
    is_multi_sentence = sentence_count > 1

    lesson_read = None
    if lesson:
        lesson_words = [WordService.to_read(w, user_id=current_user.id, db=db) for w in words]
        lesson_read = LessonRead(
            id=lesson.id,
            user_id=lesson.user_id,
            source_lang=lesson.source_lang,
            target_lang=lesson.target_lang,
            title=lesson.title,
            raw_input=lesson.raw_input,
            input_type=lesson.input_type,
            status=lesson.status,
            created_at=lesson.created_at,
            updated_at=lesson.updated_at,
            words=lesson_words,
        )

    words_read = [
        WordService.to_read(w, user_id=current_user.id, db=db)
        for w in words
    ]

    return TextSubmissionResponse(
        job_id=job.id,
        status=job.status,
        is_lesson=lesson is not None,
        is_multi_sentence=is_multi_sentence,
        sentence_count=sentence_count,
        can_create_lesson=is_multi_sentence,
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
        or getattr(current_user, "target_language", None)
        or getattr(current_user, "default_target_lang", None)
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
