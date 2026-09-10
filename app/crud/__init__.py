"""Barrel re-exporting all CRUD helpers.

Import from the specific module (e.g. ``from app.crud.word import get_or_create_word``)
when possible; this module provides a flat namespace for convenience.
"""

from app.crud.job import (
    create_job,
    get_job,
    update_job,
)
from app.crud.language import (
    create_language,
    get_language_by_code,
    get_languages,
    seed_default_languages,
)
from app.crud.lesson import (
    add_word_to_lesson,
    create_lesson,
    delete_lesson,
    get_lesson_by_id,
    get_lesson_words,
    get_user_lessons,
    update_lesson_status,
)
from app.crud.stats import (
    get_due_words,
    get_or_create_user_word_stats,
    get_user_word_stats,
    upsert_user_word_stats,
)
from app.crud.user import (
    create_user,
    ensure_admin_user,
    get_user_by_id,
    get_user_by_username,
    get_user_by_username_or_email,
    update_user,
)
from app.crud.word import (
    create_word,
    delete_word,
    get_or_create_word,
    get_word_by_id,
    get_word_by_text_and_lang,
    get_words,
)

__all__ = [
    # language
    "get_languages",
    "get_language_by_code",
    "create_language",
    "seed_default_languages",
    # user
    "get_user_by_id",
    "get_user_by_username",
    "get_user_by_username_or_email",
    "create_user",
    "update_user",
    "ensure_admin_user",
    # word
    "get_word_by_id",
    "get_word_by_text_and_lang",
    "get_words",
    "create_word",
    "get_or_create_word",
    "delete_word",
    # stats
    "get_user_word_stats",
    "get_or_create_user_word_stats",
    "upsert_user_word_stats",
    "get_due_words",
    # lesson
    "get_lesson_by_id",
    "get_user_lessons",
    "create_lesson",
    "add_word_to_lesson",
    "get_lesson_words",
    "update_lesson_status",
    "delete_lesson",
    # job
    "create_job",
    "get_job",
    "update_job",
]
