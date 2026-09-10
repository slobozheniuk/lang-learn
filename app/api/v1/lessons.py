"""Lesson endpoints: list, detail, chunking, quiz generation, preparation, completion."""

import json
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.v1._shared import (
    attach_words_to_lesson,
    get_owned_lesson,
    lesson_to_read,
    resolve_language_pair,
    words_to_quiz_payload,
)
from app.auth.dependencies import get_current_user
from app.crud.lesson import create_lesson, delete_lesson, get_user_lessons
from app.crud.stats import get_or_create_user_word_stats
from app.crud.word import get_or_create_word, get_word_by_id
from app.database import get_db
from app.models.lesson import Lesson
from app.models.user import User
from app.models.word import Word
from app.schemas.ilya_frank import IlyaFrankGenerateRequest, IlyaFrankResponse
from app.schemas.lesson import (
    ChunkItemSchema,
    LessonChunkResponse,
    LessonCompleteRequest,
    LessonCreate,
    LessonPrepareRequest,
    LessonQuizGenerateRequest,
    LessonRead,
    TextChunkRequest,
)
from app.services.job_queue import job_queue_service
from app.services.journey_logger import log_journey_event
from app.services.nlp import nlp_service

router = APIRouter()


# ---------------------------------------------------------------------------
# Word resolution helpers
# ---------------------------------------------------------------------------

def _item_to_word_info(item: Any) -> dict[str, Any]:
    """Normalize an LLMWordItem into the plain word-info dict used downstream."""
    return {
        "text": getattr(item, "target_text", None) or item.text,
        "translation": getattr(item, "source_text", None) or item.translation,
        "pos": getattr(item, "pos", None),
        "phonetic": getattr(item, "phonetic", None),
        "lemma": getattr(item, "lemma", None),
        "context_phrase": getattr(item, "context_phrase", None),
    }


async def _extract_words_from_text(
    db: Session,
    user: User,
    text: str,
    source_lang: str,
    target_lang: str,
) -> list[Word]:
    """Run LLM vocabulary extraction on raw text and upsert the resulting words."""
    extracted = await job_queue_service.llm.extract_vocabulary(
        text=text, source_lang=source_lang, target_lang=target_lang
    )
    words: list[Word] = []
    for item in extracted.items:
        info = _item_to_word_info(item)
        word = get_or_create_word(
            db,
            language_code=target_lang,
            text=info["text"],
            lemma=info["lemma"],
            pos=info["pos"],
            phonetic=info["phonetic"],
            translation=info["translation"],
            context_phrase=info["context_phrase"],
        )
        get_or_create_user_word_stats(db, user_id=user.id, word_id=word.id)
        words.append(word)
    return words


def _get_words_by_ids(db: Session, word_ids: list[int]) -> list[Word]:
    words = [w for wid in word_ids if (w := get_word_by_id(db, wid)) is not None]
    if not words:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid words found for the provided word_ids.",
        )
    return words


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[LessonRead],
    summary="List all lessons for the current user with member words",
)
def list_lessons(
    source_lang: str | None = Query(None, description="Filter by source language code (e.g. 'ru')"),
    target_lang: str | None = Query(None, description="Filter by target language code (e.g. 'en')"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LessonRead]:
    src, tgt = resolve_language_pair(current_user, source_lang, target_lang)
    lessons = get_user_lessons(
        db, user_id=current_user.id, source_lang=src, target_lang=tgt, skip=skip, limit=limit
    )
    return [lesson_to_read(l, current_user.id, db) for l in lessons]


@router.get(
    "/{lesson_id}",
    response_model=LessonRead,
    summary="Get single lesson details with member words",
)
def get_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LessonRead:
    lesson = get_owned_lesson(db, lesson_id, current_user)
    return lesson_to_read(lesson, current_user.id, db)


@router.post(
    "/generate-quiz",
    response_model=LessonRead,
    status_code=status.HTTP_201_CREATED,
    summary="Generate multiple-choice quiz questions via LLM and create a Lesson record",
)
async def generate_quiz_lesson(
    request: LessonQuizGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LessonRead:
    source_lang, target_lang = resolve_language_pair(current_user, request.source_lang, request.target_lang)

    if request.word_ids:
        words = _get_words_by_ids(db, request.word_ids)
    elif request.text and request.text.strip():
        words = await _extract_words_from_text(db, current_user, request.text, source_lang, target_lang)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either word_ids or text must be provided.",
        )

    quiz_response = await job_queue_service.llm.generate_quiz(
        words=words_to_quiz_payload(words),
        source_lang=source_lang,
        target_lang=target_lang,
        text=request.text,
        title=request.title,
    )

    lesson_title = request.title or quiz_response.title or f"Quiz: {words[0].text if words else 'Vocabulary'}"
    raw_input = request.text or ", ".join(w.text for w in words)
    lesson = create_lesson(
        db,
        user_id=current_user.id,
        lesson_in=LessonCreate(
            source_lang=source_lang,
            target_lang=target_lang,
            title=lesson_title[:250],
            raw_input=raw_input,
            input_type="quiz",
            quiz_data=quiz_response.model_dump(),
            is_completed=False,
        ),
        status="ready",
    )
    attach_words_to_lesson(db, lesson.id, words)
    return lesson_to_read(lesson, current_user.id, db)


@router.post(
    "/chunk-text",
    response_model=LessonChunkResponse,
    status_code=status.HTTP_200_OK,
    summary="Segment raw text into semantic chunks (words, idioms, collocations, punctuation)",
)
async def chunk_text_endpoint(
    request: TextChunkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LessonChunkResponse:
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text cannot be empty.")
    source_lang, target_lang = resolve_language_pair(current_user, request.source_lang, request.target_lang)

    chunk_response = await nlp_service.chunk_text(
        text=request.text,
        language_code=target_lang,
        llm=job_queue_service.llm,
    )

    lesson_id = None
    if request.create_lesson:
        lesson_title = (request.title or chunk_response.title or "Reading Lesson")[:250]
        lesson = create_lesson(
            db,
            user_id=current_user.id,
            lesson_in=LessonCreate(
                source_lang=source_lang,
                target_lang=target_lang,
                title=lesson_title,
                raw_input=request.text,
                input_type="reading",
                chunk_data=chunk_response.model_dump(),
                is_completed=False,
            ),
            status="reading",
        )
        lesson_id = lesson.id

    return LessonChunkResponse(
        title=chunk_response.title,
        chunks=[ChunkItemSchema.model_validate(c.model_dump()) for c in chunk_response.chunks],
        raw_text=chunk_response.raw_text or request.text,
        lesson_id=lesson_id,
    )


# ---------------------------------------------------------------------------
# Lesson preparation (chunk selection -> enriched vocabulary -> quiz + Frank text)
# ---------------------------------------------------------------------------

def _collect_selected_tokens(request: LessonPrepareRequest) -> tuple[list[str], dict[str, dict[str, Any]]]:
    """Flatten chunks/selected_chunks/selected_words into ordered unique tokens.

    Returns (tokens, chunk_info) where chunk_info maps lowercase token -> source
    chunk dict (used to reuse client-provided translations).
    """
    raw_selected: list[Any] = []
    if request.chunks:
        raw_selected.extend(request.chunks)
    if request.selected_chunks:
        raw_selected.extend(request.selected_chunks)
    if request.selected_words:
        raw_selected.extend(request.selected_words)

    tokens: list[str] = []
    chunk_info: dict[str, dict[str, Any]] = {}
    for item in raw_selected:
        if isinstance(item, str):
            text = item.strip()
        elif isinstance(item, dict):
            text = (item.get("text") or "").strip()
            if text:
                chunk_info[text.lower()] = item
        elif hasattr(item, "text"):
            text = str(getattr(item, "text", "")).strip()
        else:
            text = ""
        if text:
            tokens.append(text)

    # Deduplicate (case-insensitive) while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for tok in tokens:
        if tok.lower() not in seen:
            seen.add(tok.lower())
            unique.append(tok)
    return unique, chunk_info


async def _enrich_tokens(
    tokens: list[str],
    source_lang: str,
    target_lang: str,
    journey_id: str,
    user: User,
) -> dict[str, dict[str, Any]]:
    """Look up unknown tokens via LLM vocabulary extraction; map token -> word info."""
    extract_text = "\n".join(tokens)
    system_prompt = getattr(job_queue_service.llm, "build_system_prompt", lambda s, t: "")(source_lang, target_lang)
    enrich_prompt = f"{system_prompt}\n\nInput Text to process:\n{extract_text}".strip()
    log_journey_event(
        journey_id=journey_id,
        journey_type="lesson_creation",
        stage="llm_enrichment_request",
        action="LLM Vocabulary Extraction Request",
        user_id=user.id,
        username=user.username,
        data={"input_prompt": enrich_prompt, "tokens": tokens},
    )
    extracted = await job_queue_service.llm.extract_vocabulary(
        text=extract_text, source_lang=source_lang, target_lang=target_lang
    )
    log_journey_event(
        journey_id=journey_id,
        journey_type="lesson_creation",
        stage="llm_enrichment_response",
        action="LLM Vocabulary Extraction Response",
        user_id=user.id,
        username=user.username,
        data={"output": json.dumps(extracted.model_dump(), ensure_ascii=False)},
    )
    return {info["text"].lower().strip(): info for info in map(_item_to_word_info, extracted.items)}


@router.post(
    "/{lesson_id}/prepare",
    response_model=LessonRead,
    status_code=status.HTTP_200_OK,
    summary="Prepare lesson from selected word/phrase chunks: enrich vocabulary and generate quiz",
)
@router.post(
    "/prepare",
    response_model=LessonRead,
    status_code=status.HTTP_200_OK,
    summary="Prepare lesson from selected word/phrase chunks without pre-existing lesson id",
)
async def prepare_lesson_endpoint(
    request: LessonPrepareRequest,
    lesson_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LessonRead:
    lesson: Lesson | None = None
    if lesson_id is not None:
        lesson = get_owned_lesson(db, lesson_id, current_user)

    profile = current_user.get_active_profile()
    source_lang = (
        request.source_lang
        or (lesson.source_lang if lesson else None)
        or (profile.source_language if profile else None)
    )
    target_lang = (
        request.target_lang
        or (lesson.target_lang if lesson else None)
        or (profile.target_language if profile else None)
    )
    if not source_lang or not target_lang:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active learning profile required or source and target languages must be specified.",
        )

    unique_tokens, chunk_info = _collect_selected_tokens(request)
    if not unique_tokens:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one word/chunk must be selected to prepare lesson.",
        )

    journey_id = f"lesson_{lesson.id}" if lesson else f"lesson_prepare_{current_user.id}"
    log_journey_event(
        journey_id=journey_id,
        journey_type="lesson_creation",
        stage="chunks_selected",
        action="Chunks Selected by User",
        user_id=current_user.id,
        username=current_user.username,
        data={"chosen_chunks": unique_tokens, "count": len(unique_tokens)},
    )

    # Vocabulary enrichment via LLM for tokens the client did not already translate
    tokens_to_extract = [
        tok for tok in unique_tokens
        if not (chunk_info.get(tok.lower()) or {}).get("translation")
    ]
    enriched_map: dict[str, dict[str, Any]] = {}
    if tokens_to_extract:
        enriched_map = await _enrich_tokens(
            tokens_to_extract, source_lang, target_lang, journey_id, current_user
        )

    # Resolve each token to a Word row (LLM info takes precedence over chunk info)
    extracted_words: list[Word] = []
    for tok in unique_tokens:
        info: dict[str, Any] = {**chunk_info.get(tok.lower(), {}), **enriched_map.get(tok.lower(), {})}
        word = get_or_create_word(
            db,
            language_code=target_lang,
            text=info.get("text") or tok,
            translation=info.get("translation") or tok,
            pos=info.get("pos") or ("phrase" if " " in tok else "word"),
            phonetic=info.get("phonetic"),
            lemma=info.get("lemma") or tok.lower(),
            context_phrase=info.get("context_phrase"),
        )
        get_or_create_user_word_stats(db, user_id=current_user.id, word_id=word.id)
        extracted_words.append(word)

    # Quiz generation
    raw_text_context = (lesson.raw_input if lesson else None) or request.text or ", ".join(unique_tokens)
    quiz_prompt = (
        f"{getattr(job_queue_service.llm, 'build_quiz_system_prompt', lambda s, t: '')(source_lang, target_lang)}"
        f"\n\nVocabulary words: {', '.join(w.text for w in extracted_words)}"
    ).strip()
    log_journey_event(
        journey_id=journey_id,
        journey_type="lesson_creation",
        stage="llm_quiz_request",
        action="LLM Quiz Generation Request",
        user_id=current_user.id,
        username=current_user.username,
        data={"input_prompt": quiz_prompt, "words": [w.text for w in extracted_words]},
    )
    quiz_response = await job_queue_service.llm.generate_quiz(
        words=words_to_quiz_payload(extracted_words),
        source_lang=source_lang,
        target_lang=target_lang,
        text=raw_text_context,
        title=request.title or (lesson.title if lesson else None),
    )
    log_journey_event(
        journey_id=journey_id,
        journey_type="lesson_creation",
        stage="llm_quiz_response",
        action="LLM Quiz Generation Response",
        user_id=current_user.id,
        username=current_user.username,
        data={"output": json.dumps(quiz_response.model_dump(), ensure_ascii=False)},
    )

    # Ilya Frank dual-pass adaptation
    frank_response = await job_queue_service.llm.generate_ilya_frank(
        text=raw_text_context,
        selected_words=unique_tokens,
        source_lang=source_lang,
        target_lang=target_lang,
    )
    log_journey_event(
        journey_id=journey_id,
        journey_type="lesson_creation",
        stage="ilya_frank_generated",
        action="Ilya Frank Text Adaptation Generated",
        user_id=current_user.id,
        username=current_user.username,
        data={"excerpts_count": len(frank_response.excerpts), "chosen_chunks": unique_tokens},
    )

    # Create or update the lesson record
    lesson_title = (
        request.title
        or (lesson.title if lesson and lesson.title not in ("Reading Lesson", "Text Review") else None)
        or quiz_response.title
        or f"Quiz: {extracted_words[0].text if extracted_words else 'Vocabulary'}"
    )[:250]

    if lesson is None:
        lesson = create_lesson(
            db,
            user_id=current_user.id,
            lesson_in=LessonCreate(
                source_lang=source_lang,
                target_lang=target_lang,
                title=lesson_title,
                raw_input=raw_text_context or ", ".join(w.text for w in extracted_words),
                input_type="quiz",
                quiz_data=quiz_response.model_dump(),
                ilya_frank_data=frank_response.model_dump(),
                is_completed=False,
            ),
            status="ready",
        )
    else:
        lesson.title = lesson_title
        lesson.input_type = "quiz"
        lesson.status = "ready"
        lesson.quiz_data = json.dumps(quiz_response.model_dump())
        lesson.ilya_frank_data = json.dumps(frank_response.model_dump(), ensure_ascii=False)
        db.commit()
        db.refresh(lesson)

    attach_words_to_lesson(db, lesson.id, extracted_words)
    db.refresh(lesson)

    log_journey_event(
        journey_id=journey_id,
        journey_type="lesson_creation",
        stage="lesson_ready",
        action="Lesson Ready with Quiz",
        user_id=current_user.id,
        username=current_user.username,
        data={
            "lesson_id": lesson.id,
            "title": lesson.title,
            "chosen_chunks": unique_tokens,
            "quiz_questions_count": len(quiz_response.questions),
        },
    )

    return lesson_to_read(lesson, current_user.id, db)


@router.post(
    "/{lesson_id}/complete",
    response_model=LessonRead,
    summary="Mark a lesson as completed",
)
def complete_lesson(
    lesson_id: int,
    request: LessonCompleteRequest = LessonCompleteRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LessonRead:
    lesson = get_owned_lesson(db, lesson_id, current_user)
    lesson.is_completed = request.is_completed
    if request.is_completed:
        lesson.status = "completed"
    db.commit()
    db.refresh(lesson)
    return lesson_to_read(lesson, current_user.id, db)


@router.delete(
    "/{lesson_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a lesson",
)
def delete_lesson_endpoint(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not delete_lesson(db, lesson_id=lesson_id, user_id=current_user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lesson with id {lesson_id} not found.",
        )


# ---------------------------------------------------------------------------
# Ilya Frank adaptation endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/{lesson_id}/ilya-frank",
    response_model=IlyaFrankResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate or re-generate Ilya Frank dual-pass adaptation for an existing lesson",
)
async def generate_lesson_ilya_frank_endpoint(
    lesson_id: int,
    request: IlyaFrankGenerateRequest = IlyaFrankGenerateRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IlyaFrankResponse:
    lesson = get_owned_lesson(db, lesson_id, current_user)

    text_to_adapt = request.text or lesson.raw_input
    selected_words = request.selected_words
    if not selected_words and lesson.lesson_words:
        selected_words = [lw.word.text for lw in lesson.lesson_words if lw.word]

    frank_response = await job_queue_service.llm.generate_ilya_frank(
        text=text_to_adapt,
        selected_words=selected_words,
        source_lang=request.source_lang or lesson.source_lang,
        target_lang=request.target_lang or lesson.target_lang,
    )

    lesson.ilya_frank_data = json.dumps(frank_response.model_dump(), ensure_ascii=False)
    db.commit()
    db.refresh(lesson)

    log_journey_event(
        journey_id=f"lesson_{lesson.id}",
        journey_type="lesson_creation",
        stage="ilya_frank_generated",
        action="Ilya Frank Text Adaptation Generated",
        user_id=current_user.id,
        username=current_user.username,
        data={"lesson_id": lesson.id, "excerpts_count": len(frank_response.excerpts)},
    )

    return frank_response


@router.post(
    "/ilya-frank",
    response_model=IlyaFrankResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate Ilya Frank dual-pass adaptation for arbitrary text",
)
async def generate_standalone_ilya_frank_endpoint(
    request: IlyaFrankGenerateRequest,
    current_user: User = Depends(get_current_user),
) -> IlyaFrankResponse:
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Text cannot be empty.")

    profile = current_user.get_active_profile()
    source_lang = request.source_lang or (profile.source_language if profile else "en")
    target_lang = request.target_lang or (profile.target_language if profile else "nl")

    return await job_queue_service.llm.generate_ilya_frank(
        text=request.text,
        selected_words=request.selected_words,
        source_lang=source_lang,
        target_lang=target_lang,
    )
