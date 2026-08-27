from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.review import DueWordItem, ReviewResultResponse, ReviewSubmission
from app.services.review_service import ReviewService

router = APIRouter()
review_service = ReviewService()


@router.get(
    "/due",
    response_model=list[DueWordItem],
    summary="Get words due for review for the current user",
)
def get_due_reviews(
    target_lang: str | None = Query(None, description="Filter due cards by target language code (e.g. 'en', 'nl')"),
    limit: int = Query(20, ge=1, le=100, description="Max number of cards to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DueWordItem]:
    lang = target_lang or current_user.default_target_lang
    return review_service.get_due_reviews(
        db=db,
        user_id=current_user.id,
        target_lang=lang,
        limit=limit,
    )


@router.post(
    "/submit",
    response_model=ReviewResultResponse,
    summary="Submit a review rating for a word card",
)
def submit_review(
    submission: ReviewSubmission,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReviewResultResponse:
    return review_service.submit_review(
        db=db,
        user_id=current_user.id,
        submission=submission,
    )
