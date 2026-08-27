from datetime import datetime, timedelta, timezone
from typing import Protocol, runtime_checkable

from app.srs.models import CardState, Rating, ReviewResult, parse_rating

MIN_EASE_FACTOR = 1.3
DEFAULT_EASE_FACTOR = 2.5


@runtime_checkable
class SRSEngine(Protocol):
    """Protocol for pluggable Spaced Repetition algorithms (SM-2, FSRS, etc.)."""

    def calculate_next_review(
        self,
        current_state: CardState,
        score: int | str | Rating,
        review_time: datetime | None = None,
    ) -> ReviewResult:
        ...


class SM2Engine:
    """
    Pure SuperMemo-2 (SM-2) Spaced Repetition scheduling engine.

    SM-2 Algorithm Specifications:
    1. EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
       where q is the recall quality rating in [0, 5].
       EF' is bounded from below by min_ease_factor (default: 1.3).
    2. If q < 3 (failure):
       - repetition_number = 0
       - interval_days = 1.0
       - fail_count += 1
    3. If q >= 3 (success):
       - if repetition_number == 0: interval_days = 1.0
       - if repetition_number == 1: interval_days = 6.0
       - if repetition_number >= 2: interval_days = max(1.0, round(current_interval * EF'))
       - repetition_number += 1
       - recall_count += 1
    4. next_review_at = review_time + timedelta(days=interval_days)
    """

    def __init__(self, min_ease_factor: float = MIN_EASE_FACTOR):
        self.min_ease_factor = min_ease_factor

    def calculate_next_review(
        self,
        current_state: CardState,
        score: int | str | Rating,
        review_time: datetime | None = None,
    ) -> ReviewResult:
        q = parse_rating(score)

        if review_time is None:
            review_time = datetime.now(timezone.utc)
        elif review_time.tzinfo is None:
            review_time = review_time.replace(tzinfo=timezone.utc)

        rep = current_state.repetition_number
        interval = current_state.interval_days
        ef = current_state.ease_factor if current_state.ease_factor is not None else DEFAULT_EASE_FACTOR
        recalls = current_state.recall_count
        fails = current_state.fail_count

        # Calculate new Ease Factor
        delta_ef = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)
        new_ef = max(self.min_ease_factor, round(ef + delta_ef, 4))

        if q < 3:
            # Failure: reset repetition count, set 1-day interval
            new_rep = 0
            new_interval = 1.0
            new_fails = fails + 1
            new_recalls = recalls
        else:
            # Success
            if rep == 0:
                new_interval = 1.0
            elif rep == 1:
                new_interval = 6.0
            else:
                new_interval = float(max(1.0, round(interval * new_ef)))
            new_rep = rep + 1
            new_recalls = recalls + 1
            new_fails = fails

        next_review_at = review_time + timedelta(days=new_interval)

        new_state = CardState(
            repetition_number=new_rep,
            interval_days=new_interval,
            ease_factor=new_ef,
            next_review_at=next_review_at,
            last_reviewed_at=review_time,
            recall_count=new_recalls,
            fail_count=new_fails,
        )

        return ReviewResult(
            state=new_state,
            score=q,
            review_time=review_time,
        )
