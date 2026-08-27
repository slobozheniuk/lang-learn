from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, get_optional_current_user
from app.crud.language import get_language_by_code
from app.database import get_db
from app.models.user import User
from app.schemas.word import WordCreate, WordRead
from app.services.word_service import WordService

router = APIRouter()


@router.post(
    "/",
    response_model=WordRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create or retrieve a word",
)
def create_word(
    word_in: WordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WordRead:
    # Ensure language exists
    lang = get_language_by_code(db, word_in.language_code)
    if not lang:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Language '{word_in.language_code}' does not exist.",
        )

    word = WordService.create_word(db, word_in)
    word_read = WordService.get_word(db, word.id, user_id=current_user.id)
    if not word_read:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve created word",
        )
    return word_read


@router.get("/", response_model=list[WordRead], summary="List words with optional filters")
def list_words(
    language_code: str | None = Query(None, description="Filter by language code (e.g. 'en', 'nl')"),
    search: str | None = Query(None, description="Search by text, lemma, or translation"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
) -> list[WordRead]:
    user_id = current_user.id if current_user else None
    return WordService.list_words(
        db,
        language_code=language_code,
        search=search,
        skip=skip,
        limit=limit,
        user_id=user_id,
    )


@router.get("/{word_id}", response_model=WordRead, summary="Get single word details")
def get_word(
    word_id: int,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
) -> WordRead:
    user_id = current_user.id if current_user else None
    word = WordService.get_word(db, word_id, user_id=user_id)
    if not word:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Word with id {word_id} not found",
        )
    return word


@router.delete("/{word_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a word")
def delete_word(
    word_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    deleted = WordService.delete_word(db, word_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Word with id {word_id} not found",
        )
