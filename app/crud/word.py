from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.word import Word
from app.schemas.word import WordCreate


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
    language_code: str | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[Word]:
    stmt = select(Word)
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
    return word


def delete_word(db: Session, word_id: int) -> bool:
    word = get_word_by_id(db, word_id)
    if not word:
        return False
    db.delete(word)
    db.commit()
    return True
