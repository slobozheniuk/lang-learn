from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.stats import get_or_create_user_word_stats
from app.crud.word import (
    create_word as crud_create_word,
    delete_word as crud_delete_word,
    get_word_by_id,
    get_word_by_text_and_lang,
    get_words,
)
from app.models.user_word_stats import UserWordStats
from app.models.word import Word
from app.schemas.word import UserWordStatsRead, WordCreate, WordRead


def _stats_by_word_id(db: Session, user_id: int, word_ids: list[int]) -> dict[int, UserWordStats]:
    """Batch-load SRS stats for the given words, keyed by word_id (avoids N+1)."""
    if not word_ids:
        return {}
    rows = db.execute(
        select(UserWordStats).where(
            UserWordStats.user_id == user_id,
            UserWordStats.word_id.in_(word_ids),
        )
    ).scalars().all()
    return {s.word_id: s for s in rows}


class WordService:
    """Converts Word ORM rows into WordRead responses enriched with the user's SRS stats."""

    @staticmethod
    def to_read(
        word: Word,
        user_id: int | None = None,
        db: Session | None = None,
    ) -> WordRead:
        stats_read = None
        if user_id and db:
            stats = db.scalar(
                select(UserWordStats).where(
                    UserWordStats.user_id == user_id,
                    UserWordStats.word_id == word.id,
                )
            )
            if stats:
                stats_read = UserWordStatsRead.model_validate(stats)
        elif user_id and hasattr(word, "user_stats"):
            for s in word.user_stats:
                if getattr(s, "user_id", None) == user_id:
                    stats_read = UserWordStatsRead.model_validate(s)
                    break

        return WordRead(
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

    @staticmethod
    def to_read_many(words: list[Word], user_id: int, db: Session) -> list[WordRead]:
        """Convert many words with a single batched stats query."""
        stats_map = _stats_by_word_id(db, user_id, [w.id for w in words])
        results = []
        for word in words:
            stats = stats_map.get(word.id)
            results.append(
                WordRead(
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
                    user_stats=UserWordStatsRead.model_validate(stats) if stats else None,
                )
            )
        return results

    @staticmethod
    def create_word(db: Session, word_in: WordCreate, user_id: int | None = None) -> Word:
        existing = get_word_by_text_and_lang(
            db, text=word_in.text, language_code=word_in.language_code
        )
        word = existing or crud_create_word(db, word_in)

        if user_id:
            get_or_create_user_word_stats(db, user_id=user_id, word_id=word.id)

        return word

    @staticmethod
    def get_word(db: Session, word_id: int, user_id: int | None = None) -> WordRead | None:
        """Return the word only if the user has SRS stats for it (i.e. 'owns' it)."""
        word = get_word_by_id(db, word_id)
        if not word:
            return None
        stats_read = None
        if user_id:
            stats = db.scalar(
                select(UserWordStats).where(
                    UserWordStats.user_id == user_id,
                    UserWordStats.word_id == word.id,
                )
            )
            if not stats:
                return None
            stats_read = UserWordStatsRead.model_validate(stats)

        return WordRead(
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

    @staticmethod
    def list_words(
        db: Session,
        language_code: str | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 50,
        user_id: int | None = None,
    ) -> list[WordRead]:
        if user_id is None:
            return []
        words = get_words(
            db,
            user_id=user_id,
            language_code=language_code,
            search=search,
            skip=skip,
            limit=limit,
        )
        return WordService.to_read_many(words, user_id, db)

    @staticmethod
    def delete_word(db: Session, word_id: int, user_id: int | None = None) -> bool:
        return crud_delete_word(db, word_id, user_id=user_id)
