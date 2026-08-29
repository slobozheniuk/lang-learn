from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.crud.job import get_job
from app.database import get_db
from app.models.user import User
from app.schemas.job import JobRead, TextSubmissionRequest, TextSubmissionResponse
from app.schemas.lesson import LessonRead
from app.schemas.word import WordRead
from app.services.job_queue import job_queue_service
from app.services.word_service import WordService

router = APIRouter()


@router.post(
    "/submit",
    response_model=TextSubmissionResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit text to the background job queue for AI translation and lesson creation",
)
async def submit_job(
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

    words_read = [WordService.to_read(w, user_id=current_user.id, db=db) for w in words]

    return TextSubmissionResponse(
        job_id=job.id,
        status=job.status,
        is_lesson=lesson is not None,
        lesson=lesson_read,
        words=words_read,
        error_message=job.error_message,
    )


@router.get(
    "/{job_id}",
    response_model=JobRead,
    summary="Get status and details of a background job",
)
def get_job_status(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobRead:
    job = get_job(db, job_id)
    if not job or job.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job with id '{job_id}' not found.",
        )
    return JobRead.model_validate(job)
