"""Shared pytest fixtures: isolated in-memory database, test client, and users."""

from collections.abc import Generator
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.security import create_access_token, hash_password
from app.crud.language import seed_default_languages
from app.crud.stats import get_or_create_user_word_stats
from app.crud.user import create_user
from app.crud.word import create_word
from app.database import get_db
from app.main import app
from app.models.base import Base
from app.models.user import User
from app.models.word import Word
from app.schemas.user import UserCreate
from app.schemas.word import WordCreate

from app.services.job_queue import job_queue_service
from app.services.llm.mock_provider import MockLLMProvider

# Use in-memory SQLite database for fast isolated testing
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def make_user(
    db: Session,
    username: str,
    password: str = "testpassword123",
    source_lang: str = "ru",
    target_lang: str = "en",
) -> User:
    """Create a user (with its initial learning profile) directly in the DB."""
    return create_user(
        db,
        UserCreate(
            username=username,
            password=password,
            source_language=source_lang,
            target_language=target_lang,
        ),
        hashed_password=hash_password(password),
    )


def auth_headers_for(user: User) -> dict[str, str]:
    """Authorization header with a valid JWT for the given user."""
    token = create_access_token(data={"sub": str(user.id), "username": user.username})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def configure_test_llm():
    prev_provider = job_queue_service._llm_provider
    job_queue_service.set_llm_provider(MockLLMProvider())
    yield
    job_queue_service._llm_provider = prev_provider


@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    seed_default_languages(session)
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_user(db_session: Session) -> User:
    return make_user(db_session, "testuser", source_lang="ru", target_lang="en")


@pytest.fixture(scope="function")
def auth_headers(test_user: User) -> dict[str, str]:
    return auth_headers_for(test_user)


@pytest.fixture(scope="function")
def sample_words(db_session: Session, test_user: User) -> list[Word]:
    """Three words owned by test_user: two English, one Dutch."""
    words_data = [
        WordCreate(
            language_code="en",
            text="ephemeral",
            lemma="ephemeral",
            pos="adjective",
            phonetic="/ɪˈfem.ər.əl/",
            translation="мимолетный, недолговечный",
            context_phrase="Fame in the internet age is ephemeral.",
        ),
        WordCreate(
            language_code="en",
            text="serendipity",
            lemma="serendipity",
            pos="noun",
            phonetic="/ˌser.ənˈdɪp.ə.ti/",
            translation="счастливая случайность",
            context_phrase="Finding that book was pure serendipity.",
        ),
        WordCreate(
            language_code="nl",
            text="gezellig",
            lemma="gezellig",
            pos="adjective",
            phonetic="/ɣəˈzɛləx/",
            translation="уютный, приятный, душевный",
            context_phrase="Het was een heel gezellige avond.",
        ),
    ]
    created = []
    for w in words_data:
        word = create_word(db_session, w)
        get_or_create_user_word_stats(db_session, user_id=test_user.id, word_id=word.id)
        created.append(word)
    return created
