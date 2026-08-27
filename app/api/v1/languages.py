from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.crud.language import (
    create_language,
    get_language_by_code,
    get_languages,
    seed_default_languages,
)
from app.database import get_db
from app.models.user import User
from app.schemas.language import LanguageCreate, LanguageRead

router = APIRouter()


@router.get("/", response_model=list[LanguageRead], summary="List all supported languages")
def list_languages(db: Session = Depends(get_db)) -> list[LanguageRead]:
    seed_default_languages(db)
    langs = get_languages(db)
    return [LanguageRead.model_validate(lang) for lang in langs]


@router.post(
    "/",
    response_model=LanguageRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new supported language",
)
def add_language(
    lang_in: LanguageCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> LanguageRead:
    existing = get_language_by_code(db, lang_in.code.lower().strip())
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Language with code '{lang_in.code}' already exists.",
        )
    lang = create_language(db, lang_in)
    return LanguageRead.model_validate(lang)
