from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.word import UserWordStatsRead, WordRead


class ReviewSubmission(BaseModel):
    word_id: int
    rating: int | str = Field(
        ...,
        description="Rating as int (0-5) or string ('again', 'hard', 'good', 'easy')",
    )


class ReviewResultResponse(BaseModel):
    word_id: int
    score: int
    stats: UserWordStatsRead
    next_review_at: datetime


class DueWordItem(BaseModel):
    word: WordRead
    stats: UserWordStatsRead | None = None
    is_new: bool = False
