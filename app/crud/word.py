import logging
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.lesson import Lesson
from app.models.lesson_word import LessonWord
from app.models.user_word_stats import UserWordStats
from app.models.word import Word
from app.schemas.word import WordCreate

logger = logging.getLogger("app.crud.word")


def get_word_by_id(db: Session, word_id: int) -> Word | None:
    return db.scalar(select(Word).where(Word.id == word_id))


def get_word_by_text_and_lang(db: Session, text: str, language_code: str) -> Word | None:
    return db.scalar(
        select(Word).where(
            Word.text == text.strip(),
            Word.language_code == language_code.lower().strip(),
        )
    )


def get_words(
    db: Session,
    user_id: int | None = None,
    language_code: str | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[Word]:
    stmt = select(Word)
    if user_id is not None:
        stmt = stmt.join(UserWordStats, UserWordStats.word_id == Word.id).where(
            UserWordStats.user_id == user_id
        )
    else:
        return []

    if language_code:
        stmt = stmt.where(Word.language_code == language_code.lower().strip())
    if search:
        search_pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            (Word.text.ilike(search_pattern))
            | (Word.translation.ilike(search_pattern))
            | (Word.lemma.ilike(search_pattern))
        )
    stmt = stmt.order_by(Word.id.desc()).offset(skip).limit(limit)
    return list(db.scalars(stmt).all())


def create_word(db: Session, word_in: WordCreate) -> Word:
    word = Word(
        language_code=word_in.language_code.lower().strip(),
        text=word_in.text.strip(),
        lemma=word_in.lemma.strip() if word_in.lemma else None,
        pos=word_in.pos.strip() if word_in.pos else None,
        phonetic=word_in.phonetic.strip() if word_in.phonetic else None,
        translation=word_in.translation.strip() if word_in.translation else None,
        context_phrase=word_in.context_phrase.strip() if word_in.context_phrase else None,
        audio_url=word_in.audio_url.strip() if word_in.audio_url else None,
    )
    db.add(word)
    db.commit()
    db.refresh(word)
    logger.info(
        f"Word created: id={word.id}, lang='{word.language_code}', text='{word.text}', translation='{word.translation}'"
    )
    return word


def get_or_create_word(
    db: Session,
    language_code: str,
    text: str,
    lemma: str | None = None,
    pos: str | None = None,
    phonetic: str | None = None,
    translation: str | None = None,
    context_phrase: str | None = None,
    audio_url: str | None = None,
) -> Word:
    """Get existing word entry by (language_code, text) or create a new one, skipping duplicates."""
    clean_text = text.strip()
    clean_lang = language_code.lower().strip()
    existing = get_word_by_text_and_lang(db, text=clean_text, language_code=clean_lang)
    if existing:
        updated = False
        if lemma and not existing.lemma:
            existing.lemma = lemma.strip()
            updated = True
        if pos and not existing.pos:
            existing.pos = pos.strip()
            updated = True
        if phonetic and not existing.phonetic:
            existing.phonetic = phonetic.strip()
            updated = True
        if translation and not existing.translation:
            existing.translation = translation.strip()
            updated = True
        if context_phrase and not existing.context_phrase:
            existing.context_phrase = context_phrase.strip()
            updated = True
        if audio_url and not existing.audio_url:
            existing.audio_url = audio_url.strip()
            updated = True
        if updated:
            db.commit()
            db.refresh(existing)
            logger.info(f"Word updated: id={existing.id}, lang='{existing.language_code}', text='{existing.text}'")
        return existing

    word = Word(
        language_code=clean_lang,
        text=clean_text,
        lemma=lemma.strip() if lemma else None,
        pos=pos.strip() if pos else None,
        phonetic=phonetic.strip() if phonetic else None,
        translation=translation.strip() if translation else None,
        context_phrase=context_phrase.strip() if context_phrase else None,
        audio_url=audio_url.strip() if audio_url else None,
    )
    db.add(word)
    db.commit()
    db.refresh(word)
    logger.info(
        f"Word created: id={word.id}, lang='{word.language_code}', text='{word.text}', translation='{word.translation}'"
    )
    return word


def delete_word(db: Session, word_id: int, user_id: int | None = None) -> bool:
    word = get_word_by_id(db, word_id)
    if not word:
        logger.warning(f"Word deletion failed: id={word_id} not found.")
        return False

    if user_id is not None:
        stats = db.scalar(
            select(UserWordStats).where(
                UserWordStats.user_id == user_id,
                UserWordStats.word_id == word_id,
            )
        )
        # Check if user has stats or any lesson with this word
        user_lesson_words = list(
            db.scalars(
                select(LessonWord)
                .join(Lesson, Lesson.id == LessonWord.lesson_id)
                .where(Lesson.user_id == user_id, LessonWord.word_id == word_id)
            ).all()
        )
        if not stats and not user_lesson_words:
            logger.warning(f"Word deletion failed: word_id={word_id} not associated with user_id={user_id}.")
            return False

        if stats:
            db.delete(stats)
        for lw in user_lesson_words:
            db.delete(lw)
        db.commit()

        # If no other user has stats or lessons with this word, delete the word entirely
        other_stats_count = db.scalar(
            select(func.count(UserWordStats.id)).where(UserWordStats.word_id == word_id)
        )
        other_lw_count = db.scalar(
            select(func.count(LessonWord.id)).where(LessonWord.word_id == word_id)
        )
        if (other_stats_count or 0) == 0 and (other_lw_count or 0) == 0:
            db.delete(word)
            db.commit()

        logger.info(f"Word disassociated/deleted: id={word_id}, user_id={user_id}")
        return True
    else:
        db.delete(word)
        db.commit()
        logger.info(f"Word deleted: id={word_id}, text='{word.text}', lang='{word.language_code}'")
        return True
