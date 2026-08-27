from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.security import create_access_token, hash_password, verify_password
from app.crud.language import get_language_by_code, seed_default_languages
from app.crud.user import (
    create_user,
    get_user_by_email,
    get_user_by_username,
    get_user_by_username_or_email,
)
from app.database import get_db
from app.models.user import User
from app.schemas.auth import AuthResponse, LoginRequest, Token
from app.schemas.user import UserCreate, UserRead

router = APIRouter()


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(user_in: UserCreate, db: Session = Depends(get_db)) -> AuthResponse:
    # Ensure default languages exist
    seed_default_languages(db)

    # Check if username or email already exists
    if get_user_by_email(db, user_in.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )
    if get_user_by_username(db, user_in.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this username already exists.",
        )

    # Validate source and target languages exist
    if not get_language_by_code(db, user_in.default_source_lang):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid default source language '{user_in.default_source_lang}'.",
        )
    if not get_language_by_code(db, user_in.default_target_lang):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid default target language '{user_in.default_target_lang}'.",
        )

    hashed_pw = hash_password(user_in.password)
    user = create_user(db, user_in, hashed_password=hashed_pw)
    token_str = create_access_token(data={"sub": str(user.id), "username": user.username})

    return AuthResponse(
        user=UserRead.model_validate(user),
        token=Token(access_token=token_str, token_type="bearer"),
    )


@router.post("/login", response_model=Token, summary="Log in with JSON credentials")
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
) -> Token:
    user = get_user_by_username_or_email(db, identifier=login_data.username_or_email)
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is inactive.",
        )

    token_str = create_access_token(data={"sub": str(user.id), "username": user.username})
    return Token(access_token=token_str, token_type="bearer")


@router.post(
    "/login/access-token",
    response_model=Token,
    summary="OAuth2 compatible token login for OAuth2 password form",
)
def login_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
) -> Token:
    user = get_user_by_username_or_email(db, identifier=form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is inactive.",
        )

    token_str = create_access_token(data={"sub": str(user.id), "username": user.username})
    return Token(access_token=token_str, token_type="bearer")


@router.get("/me", response_model=UserRead, summary="Get current logged in user profile")
def get_me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)
