from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user_word_stats import UserWordStats
from app.models.word import Word
from app.srs.models import CardState


def get_user_word_stats(db: Session, user_id: int, word_id: int) -> UserWordStats | None:
    return db.scalar(
        select(UserWordStats).where(
            UserWordStats.user_id == user_id,
            UserWordStats.word_id == word_id,
        )
    )


def get_or_create_user_word_stats(db: Session, user_id: int, word_id: int) -> UserWordStats:
    stats = get_user_word_stats(db, user_id=user_id, word_id=word_id)
    if stats:
        return stats
    stats = UserWordStats(
        user_id=user_id,
        word_id=word_id,
        repetition_number=0,
        interval_days=0.0,
        ease_factor=2.5,
        next_review_at=datetime.now(timezone.utc),
        recall_count=0,
        fail_count=0,
    )
    db.add(stats)
    db.commit()
    db.refresh(stats)
    return stats


def upsert_user_word_stats(
    db: Session,
    user_id: int,
    word_id: int,
    card_state: CardState,
) -> UserWordStats:
    stats = get_user_word_stats(db, user_id=user_id, word_id=word_id)
    if not stats:
        stats = UserWordStats(
            user_id=user_id,
            word_id=word_id,
            repetition_number=card_state.repetition_number,
            interval_days=card_state.interval_days,
            ease_factor=card_state.ease_factor,
            next_review_at=card_state.next_review_at or datetime.now(timezone.utc),
            last_reviewed_at=card_state.last_reviewed_at,
            recall_count=card_state.recall_count,
            fail_count=card_state.fail_count,
        )
        db.add(stats)
    else:
        stats.repetition_number = card_state.repetition_number
        stats.interval_days = card_state.interval_days
        stats.ease_factor = card_state.ease_factor
        stats.next_review_at = card_state.next_review_at or datetime.now(timezone.utc)
        stats.last_reviewed_at = card_state.last_reviewed_at
        stats.recall_count = card_state.recall_count
        stats.fail_count = card_state.fail_count

    db.commit()
    db.refresh(stats)
    return stats


def get_due_words(
    db: Session,
    user_id: int,
    target_lang: str | None = None,
    limit: int = 20,
    current_time: datetime | None = None,
) -> list[tuple[Word, UserWordStats | None]]:
    """
    Fetch cards due for review for a user.
    Only returns cards belonging to user_id in user_word_stats where next_review_at <= current_time.
    """
    if current_time is None:
        current_time = datetime.now(timezone.utc)
    elif current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)

    # Fetch scheduled due cards for this user
    due_stmt = (
        select(Word, UserWordStats)
        .join(UserWordStats, UserWordStats.word_id == Word.id)
        .where(
            UserWordStats.user_id == user_id,
            UserWordStats.next_review_at <= current_time,
        )
    )
    if target_lang:
        due_stmt = due_stmt.where(Word.language_code == target_lang.lower().strip())

    due_stmt = due_stmt.order_by(UserWordStats.next_review_at.asc(), Word.id.desc()).limit(limit)
    due_results = list(db.execute(due_stmt).all())

    results: list[tuple[Word, UserWordStats | None]] = [
        (word, stats) for word, stats in due_results
    ]

    return results
