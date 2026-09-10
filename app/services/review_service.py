import logging
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud.stats import get_due_words, get_user_word_stats, upsert_user_word_stats
from app.crud.word import get_word_by_id
from app.schemas.review import DueWordItem, ReviewResultResponse, ReviewSubmission
from app.schemas.word import UserWordStatsRead
from app.srs.engine import SM2Engine, SRSEngine
from app.srs.models import CardState, parse_rating
from app.services.word_service import WordService

logger = logging.getLogger("app.services.review")


class ReviewService:
    def __init__(self, srs_engine: SRSEngine | None = None):
        self.srs_engine = srs_engine or SM2Engine()

    def get_due_reviews(
        self,
        db: Session,
        user_id: int,
        target_lang: str | None = None,
        limit: int = 20,
        current_time: datetime | None = None,
    ) -> list[DueWordItem]:
        due_items = get_due_words(
            db,
            user_id=user_id,
            target_lang=target_lang,
            limit=limit,
            current_time=current_time,
        )

        words = [word for word, _ in due_items]
        word_reads = WordService.to_read_many(words, user_id, db)
        by_id = {w.id: w for w in word_reads}

        results: list[DueWordItem] = []
        for word, stats in due_items:
            stats_read = UserWordStatsRead.model_validate(stats) if stats else None
            is_new_card = stats is None or stats.repetition_number == 0 or stats.last_reviewed_at is None
            results.append(
                DueWordItem(
                    word=by_id[word.id],
                    stats=stats_read,
                    is_new=is_new_card,
                )
            )
        logger.info(
            f"Retrieved due reviews: user_id={user_id}, target_lang='{target_lang}', count={len(results)}"
        )
        return results

    def submit_review(
        self,
        db: Session,
        user_id: int,
        submission: ReviewSubmission,
        review_time: datetime | None = None,
    ) -> ReviewResultResponse:
        word = get_word_by_id(db, submission.word_id)
        if not word:
            logger.warning(f"Review submission failed: word id={submission.word_id} not found.")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Word with id {submission.word_id} not found",
            )

        try:
            score = parse_rating(submission.rating)
        except (ValueError, TypeError) as e:
            logger.warning(
                f"Review submission invalid rating: user_id={user_id}, word_id={submission.word_id}, rating='{submission.rating}', error={e}"
            )
            raise HTTPException(
                status_code=422,
                detail=str(e),
            )

        stats = get_user_word_stats(db, user_id=user_id, word_id=word.id)
        current_state = (
            CardState(
                repetition_number=stats.repetition_number,
                interval_days=stats.interval_days,
                ease_factor=stats.ease_factor,
                next_review_at=stats.next_review_at,
                last_reviewed_at=stats.last_reviewed_at,
                recall_count=stats.recall_count,
                fail_count=stats.fail_count,
            )
            if stats
            else CardState()
        )

        review_result = self.srs_engine.calculate_next_review(
            current_state=current_state,
            score=score,
            review_time=review_time,
        )

        updated_stats = upsert_user_word_stats(
            db=db,
            user_id=user_id,
            word_id=word.id,
            card_state=review_result.state,
        )

        logger.info(
            f"Review processed: user_id={user_id}, word_id={word.id} ('{word.text}'), "
            f"rating='{submission.rating}' (score={score}) | "
            f"prev: (rep={current_state.repetition_number}, interval={current_state.interval_days:.1f}d, EF={current_state.ease_factor:.2f}) -> "
            f"new: (rep={updated_stats.repetition_number}, interval={updated_stats.interval_days:.1f}d, EF={updated_stats.ease_factor:.2f}, next_review={updated_stats.next_review_at})"
        )

        return ReviewResultResponse(
            word_id=word.id,
            score=score,
            stats=UserWordStatsRead.model_validate(updated_stats),
            next_review_at=updated_stats.next_review_at,
        )
