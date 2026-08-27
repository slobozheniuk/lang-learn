from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud.stats import get_due_words, get_user_word_stats, upsert_user_word_stats
from app.crud.word import get_word_by_id
from app.schemas.review import DueWordItem, ReviewResultResponse, ReviewSubmission
from app.schemas.word import UserWordStatsRead, WordRead
from app.srs.engine import SM2Engine, SRSEngine
from app.srs.models import CardState, parse_rating


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

        results: list[DueWordItem] = []
        for word, stats in due_items:
            stats_read = UserWordStatsRead.model_validate(stats) if stats else None
            word_read = WordRead(
                id=word.id,
                language_code=word.language_code,
                text=word.text,
                lemma=word.lemma,
                pos=word.pos,
                phonetic=word.phonetic,
                translation=word.translation,
                context_phrase=word.context_phrase,
                audio_url=word.audio_url,
                created_at=word.created_at,
                updated_at=word.updated_at,
                user_stats=stats_read,
            )
            results.append(
                DueWordItem(
                    word=word_read,
                    stats=stats_read,
                    is_new=(stats is None),
                )
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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Word with id {submission.word_id} not found",
            )

        try:
            score = parse_rating(submission.rating)
        except (ValueError, TypeError) as e:
            raise HTTPException(
                status_code=422,
                detail=str(e),
            )

        stats = get_user_word_stats(db, user_id=user_id, word_id=word.id)
        if stats:
            current_state = CardState(
                repetition_number=stats.repetition_number,
                interval_days=stats.interval_days,
                ease_factor=stats.ease_factor,
                next_review_at=stats.next_review_at,
                last_reviewed_at=stats.last_reviewed_at,
                recall_count=stats.recall_count,
                fail_count=stats.fail_count,
            )
        else:
            current_state = CardState()

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

        return ReviewResultResponse(
            word_id=word.id,
            score=score,
            stats=UserWordStatsRead.model_validate(updated_stats),
            next_review_at=updated_stats.next_review_at,
        )
