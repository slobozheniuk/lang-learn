from collections.abc import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


import logging

logger = logging.getLogger("app.database")


def ensure_db_schema_updated() -> None:
    """Safely and backward-compatibly update SQLite tables if columns are missing."""
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    logger.info("Checking database schema compatibility...")
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(users)"))
        cols = {row[1] for row in result.fetchall()}
        if cols:
            for old_col in ["native_language", "target_language", "default_source_lang", "default_target_lang", "email"]:
                if old_col in cols:
                    try:
                        logger.info(f"Applying schema migration: dropping '{old_col}' column from users table")
                        conn.execute(text(f"ALTER TABLE users DROP COLUMN {old_col}"))
                    except Exception as e:
                        logger.warning(f"Could not drop {old_col} column: {e}")
            conn.commit()

        result_lessons = conn.execute(text("PRAGMA table_info(lessons)"))
        lesson_cols = {row[1] for row in result_lessons.fetchall()}
        if lesson_cols:
            if "quiz_data" not in lesson_cols:
                logger.info("Applying schema migration: adding 'quiz_data' column to lessons table")
                conn.execute(text("ALTER TABLE lessons ADD COLUMN quiz_data TEXT"))
            if "chunk_data" not in lesson_cols:
                logger.info("Applying schema migration: adding 'chunk_data' column to lessons table")
                conn.execute(text("ALTER TABLE lessons ADD COLUMN chunk_data TEXT"))
            if "is_completed" not in lesson_cols:
                logger.info("Applying schema migration: adding 'is_completed' column to lessons table")
                conn.execute(text("ALTER TABLE lessons ADD COLUMN is_completed BOOLEAN DEFAULT 0 NOT NULL"))
            conn.commit()

        # Check learning_profiles table
        result_profiles = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='learning_profiles'"))
        if not result_profiles.fetchone():
            logger.info("Creating learning_profiles table")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS learning_profiles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    source_language VARCHAR(10) NOT NULL,
                    target_language VARCHAR(10) NOT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, source_language, target_language)
                )
            """))
            conn.commit()

        # Backfill default learning profiles for users without any profile
        try:
            conn.execute(text("""
                INSERT OR IGNORE INTO learning_profiles (user_id, source_language, target_language, is_active, created_at, updated_at)
                SELECT id, 'ru', 'en', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                FROM users
                WHERE id NOT IN (SELECT DISTINCT user_id FROM learning_profiles)
            """))
            conn.commit()
        except Exception as e:
            logger.warning(f"Could not backfill learning profiles: {e}")
    logger.info("Database schema is up to date.")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

