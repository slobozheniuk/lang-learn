import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.job import Job


def create_job(
    db: Session,
    user_id: int,
    input_text: str,
    source_lang: str = "ru",
    target_lang: str = "en",
    type: str = "text_translation",
    lesson_id: int | None = None,
) -> Job:
    job = Job(
        id=str(uuid.uuid4()),
        user_id=user_id,
        type=type,
        status="queued",
        input_text=input_text.strip(),
        source_lang=source_lang.lower().strip(),
        target_lang=target_lang.lower().strip(),
        lesson_id=lesson_id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, job_id: str) -> Job | None:
    return db.scalar(select(Job).where(Job.id == job_id))


def update_job(
    db: Session,
    job_id: str,
    status: str,
    lesson_id: int | None = None,
    result_json: str | None = None,
    error_message: str | None = None,
) -> Job | None:
    job = get_job(db, job_id)
    if not job:
        return None
    job.status = status
    if lesson_id is not None:
        job.lesson_id = lesson_id
    if result_json is not None:
        job.result_json = result_json
    if error_message is not None:
        job.error_message = error_message
    db.commit()
    db.refresh(job)
    return job


def get_pending_jobs(db: Session, limit: int = 100) -> list[Job]:
    return list(
        db.scalars(
            select(Job)
            .where(Job.status.in_(["queued", "processing"]))
            .order_by(Job.created_at.asc())
            .limit(limit)
        ).all()
    )
