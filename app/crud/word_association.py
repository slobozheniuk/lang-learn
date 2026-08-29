import logging
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.word_association import WordAssociation

logger = logging.getLogger("app.crud.word_association")


def get_association(
    db: Session, source_word_id: int, target_word_id: int
) -> WordAssociation | None:
    return db.scalar(
        select(WordAssociation).where(
            WordAssociation.source_word_id == source_word_id,
            WordAssociation.target_word_id == target_word_id,
        )
    )


def get_or_create_association(
    db: Session,
    source_word_id: int,
    target_word_id: int,
    source_lang: str,
    target_lang: str,
    context: str | None = None,
) -> WordAssociation:
    existing = get_association(db, source_word_id, target_word_id)
    if existing:
        if context and not existing.context:
            existing.context = context
            db.commit()
            db.refresh(existing)
            logger.info(f"Word association updated with context: id={existing.id}")
        return existing

    association = WordAssociation(
        source_word_id=source_word_id,
        target_word_id=target_word_id,
        source_lang=source_lang.lower().strip(),
        target_lang=target_lang.lower().strip(),
        context=context.strip() if context else None,
    )
    db.add(association)
    db.commit()
    db.refresh(association)
    logger.info(
        f"Word association created: id={association.id}, source_word_id={source_word_id} ({source_lang}), target_word_id={target_word_id} ({target_lang})"
    )
    return association


def get_associations_for_word(db: Session, word_id: int) -> list[WordAssociation]:
    return list(
        db.scalars(
            select(WordAssociation).where(
                (WordAssociation.source_word_id == word_id)
                | (WordAssociation.target_word_id == word_id)
            )
        ).all()
    )
