from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.language import Language
from app.schemas.language import LanguageCreate

DEFAULT_LANGUAGES = [
    {"code": "ru", "name": "Russian"},
    {"code": "en", "name": "English"},
    {"code": "nl", "name": "Dutch"},
]


def get_languages(db: Session) -> list[Language]:
    return list(db.scalars(select(Language).order_by(Language.code)).all())


def get_language_by_code(db: Session, code: str) -> Language | None:
    return db.scalar(select(Language).where(Language.code == code))


def create_language(db: Session, lang_in: LanguageCreate) -> Language:
    lang = Language(code=lang_in.code.lower(), name=lang_in.name)
    db.add(lang)
    db.commit()
    db.refresh(lang)
    return lang


def seed_default_languages(db: Session) -> list[Language]:
    """Ensure standard languages (ru, en, nl) exist in the database."""
    seeded = []
    for item in DEFAULT_LANGUAGES:
        existing = get_language_by_code(db, item["code"])
        if not existing:
            lang = Language(code=item["code"], name=item["name"])
            db.add(lang)
            seeded.append(lang)
    if seeded:
        db.commit()
        for lang in seeded:
            db.refresh(lang)
    return get_languages(db)
