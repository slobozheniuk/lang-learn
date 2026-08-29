import logging
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.security import create_access_token, hash_password, verify_password
from app.crud.language import get_language_by_code, seed_default_languages
from app.crud.user import (
    create_user,
    get_user_by_username,
    get_user_by_username_or_email,
    update_user,
)
from app.database import get_db
from app.models.learning_profile import LearningProfile
from app.models.user import User
from app.schemas.auth import AuthResponse, LoginRequest, Token
from app.schemas.user import UserCreate, UserRead, UserUpdate

logger = logging.getLogger("app.auth")
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

    if get_user_by_username(db, user_in.username):
        logger.warning(f"Registration failed: username '{user_in.username}' already exists.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this username already exists.",
        )

    native_lang = (user_in.native_language or user_in.default_source_lang or "ru").lower().strip()
    target_lang = (user_in.target_language or user_in.default_target_lang or "en").lower().strip()

    # Validate source and target languages exist
    if not get_language_by_code(db, native_lang):
        logger.warning(f"Registration failed: invalid source language '{native_lang}'.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid default source language '{native_lang}'.",
        )
    if not get_language_by_code(db, target_lang):
        logger.warning(f"Registration failed: invalid target language '{target_lang}'.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid default target language '{target_lang}'.",
        )

    hashed_pw = hash_password(user_in.password)
    user = create_user(db, user_in, hashed_password=hashed_pw)

    # Create default learning profile
    profile = LearningProfile(
        user_id=user.id,
        source_language=native_lang,
        target_language=target_lang,
        is_active=True,
    )
    db.add(profile)
    db.commit()
    db.refresh(user)

    token_str = create_access_token(data={"sub": str(user.id), "username": user.username})

    logger.info(
        f"User registration successful: user_id={user.id}, username='{user.username}', "
        f"native_lang='{native_lang}', target_lang='{target_lang}'"
    )

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
        logger.warning(f"Login failed: invalid credentials for identifier='{login_data.username_or_email}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        logger.warning(f"Login rejected: user_id={user.id} ('{user.username}') is inactive.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is inactive.",
        )

    token_str = create_access_token(data={"sub": str(user.id), "username": user.username})
    logger.info(f"User login successful: user_id={user.id}, username='{user.username}'")
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
        logger.warning(f"OAuth2 login failed: invalid credentials for username='{form_data.username}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        logger.warning(f"OAuth2 login rejected: user_id={user.id} ('{user.username}') is inactive.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is inactive.",
        )

    token_str = create_access_token(data={"sub": str(user.id), "username": user.username})
    logger.info(f"OAuth2 user login successful: user_id={user.id}, username='{user.username}'")
    return Token(access_token=token_str, token_type="bearer")


@router.get("/me", response_model=UserRead, summary="Get current logged in user profile")
def get_me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@router.patch("/me", response_model=UserRead, summary="Update current user profile/settings")
@router.put("/me", response_model=UserRead, summary="Update current user profile/settings")
def update_me(
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserRead:
    native_lang = user_in.native_language or user_in.default_source_lang
    if native_lang:
        if not get_language_by_code(db, native_lang.lower().strip()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid native language '{native_lang}'.",
            )
    target_lang = user_in.target_language or user_in.default_target_lang
    if target_lang:
        if not get_language_by_code(db, target_lang.lower().strip()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid target language '{target_lang}'.",
            )

    if user_in.username and user_in.username.strip() != current_user.username:
        existing = get_user_by_username(db, user_in.username)
        if existing and existing.id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this username already exists.",
            )

    updated = update_user(db, current_user, user_in)
    logger.info(
        f"User profile updated: user_id={updated.id}, username='{updated.username}', "
        f"native_lang='{updated.native_language}', target_lang='{updated.target_language}'"
    )
    return UserRead.model_validate(updated)
