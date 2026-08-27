from sqlalchemy.orm import Session

from app.crud.stats import get_user_word_stats
from app.crud.word import (
    create_word as crud_create_word,
    delete_word as crud_delete_word,
    get_word_by_id,
    get_word_by_text_and_lang,
    get_words,
)
from app.models.word import Word
from app.schemas.word import UserWordStatsRead, WordCreate, WordRead


class WordService:
    @staticmethod
    def create_word(db: Session, word_in: WordCreate) -> Word:
        existing = get_word_by_text_and_lang(
            db, text=word_in.text, language_code=word_in.language_code
        )
        if existing:
            return existing
        return crud_create_word(db, word_in)

    @staticmethod
    def get_word(
        db: Session, word_id: int, user_id: int | None = None
    ) -> WordRead | None:
        word = get_word_by_id(db, word_id)
        if not word:
            return None
        stats_read = None
        if user_id:
            stats = get_user_word_stats(db, user_id=user_id, word_id=word.id)
            if stats:
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
        words = get_words(
            db,
            language_code=language_code,
            search=search,
            skip=skip,
            limit=limit,
        )
        results: list[WordRead] = []
        for word in words:
            stats_read = None
            if user_id:
                stats = get_user_word_stats(db, user_id=user_id, word_id=word.id)
                if stats:
                    stats_read = UserWordStatsRead.model_validate(stats)
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
                    user_stats=stats_read,
                )
            )
        return results

    @staticmethod
    def delete_word(db: Session, word_id: int) -> bool:
        return crud_delete_word(db, word_id)
