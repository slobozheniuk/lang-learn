from dataclasses import dataclass
from datetime import datetime
from enum import IntEnum


class Rating(IntEnum):
    AGAIN = 1  # Score 1: Reset interval, decrease EF
    HARD = 3   # Score 3: Advance interval, slight EF decrease
    GOOD = 4   # Score 4: Advance interval, steady EF
    EASY = 5   # Score 5: Advance interval, increase EF


RATING_MAP: dict[str, Rating] = {
    "again": Rating.AGAIN,
    "hard": Rating.HARD,
    "good": Rating.GOOD,
    "easy": Rating.EASY,
}


def parse_rating(rating: int | str | Rating) -> int:
    """Parse integer, string, or Rating enum into a valid SM-2 score (0-5)."""
    if isinstance(rating, Rating):
        return int(rating)
    if isinstance(rating, int):
        if not (0 <= rating <= 5):
            raise ValueError(f"Rating score must be between 0 and 5, got {rating}")
        return rating
    if isinstance(rating, str):
        cleaned = rating.strip().lower()
        if cleaned in RATING_MAP:
            return int(RATING_MAP[cleaned])
        try:
            val = int(cleaned)
            if 0 <= val <= 5:
                return val
        except ValueError:
            pass
        raise ValueError(
            f"Invalid rating string '{rating}'. Expected one of {list(RATING_MAP.keys())} or integer 0-5."
        )
    raise TypeError(f"Unsupported rating type: {type(rating)}")


@dataclass
class CardState:
    repetition_number: int = 0
    interval_days: float = 0.0
    ease_factor: float = 2.5
    next_review_at: datetime | None = None
    last_reviewed_at: datetime | None = None
    recall_count: int = 0
    fail_count: int = 0


@dataclass
class ReviewResult:
    state: CardState
    score: int
    review_time: datetime
