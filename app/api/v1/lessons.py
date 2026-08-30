import json
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.crud.lesson import (
    add_word_to_lesson,
    create_lesson,
    delete_lesson,
    get_lesson_by_id,
    get_user_lessons,
)
from app.crud.stats import get_or_create_user_word_stats
from app.crud.word import get_or_create_word, get_word_by_id
from app.database import get_db
from app.models.user import User
from app.models.word import Word
from app.schemas.job import TextSubmissionRequest, TextSubmissionResponse
from app.schemas.lesson import (
    ChunkItemSchema,
    LessonCreate,
    LessonChunkResponse,
    LessonCompleteRequest,
    LessonPrepareRequest,
    LessonQuizGenerateRequest,
    LessonRead,
    TextChunkRequest,
)
from app.schemas.word import WordRead
from app.services.job_queue import count_sentences, job_queue_service
from app.services.word_service import WordService

router = APIRouter()


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
    active_profile = current_user.get_active_profile()
    src = (
        source_lang
        or (active_profile.source_language if active_profile else None)
        or getattr(current_user, "native_language", None)
        or getattr(current_user, "default_source_lang", None)
    )
    tgt = (
        target_lang
        or (active_profile.target_language if active_profile else None)
        or getattr(current_user, "target_language", None)
        or getattr(current_user, "default_target_lang", None)
    )
    lessons = get_user_lessons(
        db,
        user_id=current_user.id,
        source_lang=src,
        target_lang=tgt,
        skip=skip,
        limit=limit,
    )
    results: list[LessonRead] = []
    for lesson in lessons:
        words = [
            WordService.to_read(lw.word, user_id=current_user.id, db=db)
            for lw in lesson.lesson_words
            if lw.word
        ]
        results.append(
            LessonRead(
                id=lesson.id,
                user_id=lesson.user_id,
                source_lang=lesson.source_lang,
                target_lang=lesson.target_lang,
                title=lesson.title,
                raw_input=lesson.raw_input,
                input_type=lesson.input_type,
                status=lesson.status,
                is_completed=lesson.is_completed,
                quiz_data=lesson.quiz_data,
                chunk_data=lesson.chunk_data,
                created_at=lesson.created_at,
                updated_at=lesson.updated_at,
                words=words,
            )
        )
    return results


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
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson or lesson.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lesson with id {lesson_id} not found.",
        )
    words = [
        WordService.to_read(lw.word, user_id=current_user.id, db=db)
        for lw in lesson.lesson_words
        if lw.word
    ]
    return LessonRead(
        id=lesson.id,
        user_id=lesson.user_id,
        source_lang=lesson.source_lang,
        target_lang=lesson.target_lang,
        title=lesson.title,
        raw_input=lesson.raw_input,
        input_type=lesson.input_type,
        status=lesson.status,
        is_completed=lesson.is_completed,
        quiz_data=lesson.quiz_data,
        chunk_data=lesson.chunk_data,
        created_at=lesson.created_at,
        updated_at=lesson.updated_at,
        words=words,
    )


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
    active_profile = current_user.get_active_profile()
    source_lang = (
        request.source_lang
        or (active_profile.source_language if active_profile else None)
        or getattr(current_user, "native_language", None)
        or getattr(current_user, "default_source_lang", None)
        or "ru"
    )
    target_lang = (
        request.target_lang
        or (active_profile.target_language if active_profile else None)
        or getattr(current_user, "target_language", None)
        or getattr(current_user, "default_target_lang", None)
        or "en"
    )

    words = []
    if request.word_ids and len(request.word_ids) > 0:
        for wid in request.word_ids:
            w = get_word_by_id(db, wid)
            if w:
                words.append(w)
        if not words:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid words found for the provided word_ids.",
            )
    elif request.text and request.text.strip():
        extracted = await job_queue_service.llm.extract_vocabulary(
            text=request.text,
            source_lang=source_lang,
            target_lang=target_lang,
        )
        items = extracted.items
        if not items:
            items = [
                WordRead(
                    id=0,
                    language_code=target_lang,
                    text=request.text.strip(),
                    translation=request.text.strip(),
                )
            ]
        for item in items:
            target_text = item.target_text if hasattr(item, "target_text") else item.text
            source_text = item.source_text if hasattr(item, "source_text") else item.translation
            pos = getattr(item, "pos", None)
            phonetic = getattr(item, "phonetic", None)
            lemma = getattr(item, "lemma", None)
            context_phrase = getattr(item, "context_phrase", None)

            target_word = get_or_create_word(
                db,
                language_code=target_lang,
                text=target_text,
                lemma=lemma,
                pos=pos,
                phonetic=phonetic,
                translation=source_text,
                context_phrase=context_phrase,
            )
            get_or_create_user_word_stats(db, user_id=current_user.id, word_id=target_word.id)
            words.append(target_word)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either word_ids or text must be provided.",
        )

    words_data = [
        {
            "text": w.text,
            "translation": w.translation,
            "pos": w.pos,
            "phonetic": w.phonetic,
            "context_phrase": w.context_phrase,
        }
        for w in words
    ]

    quiz_response = await job_queue_service.llm.generate_quiz(
        words=words_data,
        source_lang=source_lang,
        target_lang=target_lang,
        text=request.text,
        title=request.title,
    )

    lesson_title = request.title or quiz_response.title or f"Quiz: {words[0].text if words else 'Vocabulary'}"
    if len(lesson_title) > 250:
        lesson_title = lesson_title[:250]

    raw_input = request.text or ", ".join(w.text for w in words)
    lesson_in = LessonCreate(
        source_lang=source_lang,
        target_lang=target_lang,
        title=lesson_title,
        raw_input=raw_input,
        input_type="quiz",
        quiz_data=quiz_response.model_dump(),
        is_completed=False,
    )
    lesson = create_lesson(db, user_id=current_user.id, lesson_in=lesson_in, status="ready")

    for idx, w in enumerate(words):
        add_word_to_lesson(db, lesson_id=lesson.id, word_id=w.id, order_index=idx)

    words_read = [WordService.to_read(w, user_id=current_user.id, db=db) for w in words]
    return LessonRead(
        id=lesson.id,
        user_id=lesson.user_id,
        source_lang=lesson.source_lang,
        target_lang=lesson.target_lang,
        title=lesson.title,
        raw_input=lesson.raw_input,
        input_type=lesson.input_type,
        status=lesson.status,
        is_completed=lesson.is_completed,
        quiz_data=lesson.quiz_data,
        chunk_data=lesson.chunk_data,
        created_at=lesson.created_at,
        updated_at=lesson.updated_at,
        words=words_read,
    )


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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text cannot be empty.",
        )
    active_profile = current_user.get_active_profile()
    source_lang = (
        request.source_lang
        or (active_profile.source_language if active_profile else None)
        or getattr(current_user, "native_language", None)
        or getattr(current_user, "default_source_lang", None)
        or "ru"
    )
    target_lang = (
        request.target_lang
        or (active_profile.target_language if active_profile else None)
        or getattr(current_user, "target_language", None)
        or getattr(current_user, "default_target_lang", None)
        or "en"
    )

    chunk_response = await job_queue_service.llm.chunk_text(
        text=request.text,
        source_lang=source_lang,
        target_lang=target_lang,
    )

    lesson_id = None
    if request.create_lesson:
        lesson_title = request.title or chunk_response.title or "Reading Lesson"
        if len(lesson_title) > 250:
            lesson_title = lesson_title[:250]
        lesson_in = LessonCreate(
            source_lang=source_lang,
            target_lang=target_lang,
            title=lesson_title,
            raw_input=request.text,
            input_type="reading",
            chunk_data=chunk_response.model_dump(),
            is_completed=False,
        )
        created_lesson = create_lesson(db, user_id=current_user.id, lesson_in=lesson_in, status="reading")
        lesson_id = created_lesson.id

    return LessonChunkResponse(
        title=chunk_response.title,
        chunks=[ChunkItemSchema.model_validate(c.model_dump()) for c in chunk_response.chunks],
        raw_text=chunk_response.raw_text or request.text,
        lesson_id=lesson_id,
    )


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
    lesson = None
    if lesson_id is not None:
        lesson = get_lesson_by_id(db, lesson_id)
        if not lesson or lesson.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Lesson with id {lesson_id} not found.",
            )

    active_profile = current_user.get_active_profile()
    source_lang = (
        request.source_lang
        or (lesson.source_lang if lesson else None)
        or (active_profile.source_language if active_profile else None)
        or getattr(current_user, "native_language", None)
        or getattr(current_user, "default_source_lang", None)
        or "ru"
    )
    target_lang = (
        request.target_lang
        or (lesson.target_lang if lesson else None)
        or (active_profile.target_language if active_profile else None)
        or getattr(current_user, "target_language", None)
        or getattr(current_user, "default_target_lang", None)
        or "en"
    )

    # Extract selected items
    raw_selected: list[Any] = []
    if request.chunks:
        raw_selected.extend(request.chunks)
    if request.selected_chunks:
        raw_selected.extend(request.selected_chunks)
    if request.selected_words:
        for sw in request.selected_words:
            raw_selected.append(sw)

    if not raw_selected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one word/chunk must be selected to prepare lesson.",
        )

    # Normalize selected items
    selected_tokens: list[str] = []
    token_dict_info: dict[str, dict[str, Any]] = {}
    for it in raw_selected:
        if isinstance(it, str):
            txt = it.strip()
            if txt:
                selected_tokens.append(txt)
        elif isinstance(it, dict):
            txt = it.get("text", "").strip()
            if txt:
                selected_tokens.append(txt)
                token_dict_info[txt.lower()] = it
        elif hasattr(it, "text"):
            txt = str(getattr(it, "text", "")).strip()
            if txt:
                selected_tokens.append(txt)

    # Deduplicate while preserving order
    seen = set()
    unique_tokens: list[str] = []
    for tok in selected_tokens:
        if tok.lower() not in seen:
            seen.add(tok.lower())
            unique_tokens.append(tok)

    if not unique_tokens:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid selectable words/chunks were provided.",
        )

    # Vocabulary enrichment via LLM
    tokens_to_extract = [
        tok for tok in unique_tokens
        if not (token_dict_info.get(tok.lower()) and token_dict_info[tok.lower()].get("translation"))
    ]

    enriched_map: dict[str, dict[str, Any]] = {}
    if tokens_to_extract:
        extract_text = "\n".join(tokens_to_extract)
        extracted_response = await job_queue_service.llm.extract_vocabulary(
            text=extract_text,
            source_lang=source_lang,
            target_lang=target_lang,
        )
        for item in extracted_response.items:
            t_text = item.target_text if hasattr(item, "target_text") else item.text
            enriched_map[t_text.lower().strip()] = {
                "text": t_text,
                "translation": item.source_text if hasattr(item, "source_text") else item.translation,
                "pos": getattr(item, "pos", None),
                "phonetic": getattr(item, "phonetic", None),
                "lemma": getattr(item, "lemma", None),
                "context_phrase": getattr(item, "context_phrase", None),
            }

    extracted_words: list[Word] = []
    for tok in unique_tokens:
        chunk_info = token_dict_info.get(tok.lower(), {})
        llm_info = enriched_map.get(tok.lower(), {})

        target_text = llm_info.get("text") or chunk_info.get("text") or tok
        translation = llm_info.get("translation") or chunk_info.get("translation") or tok
        pos = llm_info.get("pos") or chunk_info.get("pos") or ("phrase" if " " in tok else "word")
        phonetic = llm_info.get("phonetic") or chunk_info.get("phonetic")
        lemma = llm_info.get("lemma") or chunk_info.get("lemma") or tok.lower()
        context_phrase = llm_info.get("context_phrase") or chunk_info.get("context_phrase")

        w = get_or_create_word(
            db,
            language_code=target_lang,
            text=target_text,
            lemma=lemma,
            pos=pos,
            phonetic=phonetic,
            translation=translation,
            context_phrase=context_phrase,
        )
        get_or_create_user_word_stats(db, user_id=current_user.id, word_id=w.id)
        extracted_words.append(w)

    # Generate quiz questions for selected words
    words_data = [
        {
            "text": w.text,
            "translation": w.translation,
            "pos": w.pos,
            "phonetic": w.phonetic,
            "context_phrase": w.context_phrase,
        }
        for w in extracted_words
    ]

    raw_text_context = (lesson.raw_input if lesson else None) or request.text
    quiz_response = await job_queue_service.llm.generate_quiz(
        words=words_data,
        source_lang=source_lang,
        target_lang=target_lang,
        text=raw_text_context,
        title=request.title or (lesson.title if lesson else None),
    )

    lesson_title = (
        request.title
        or (lesson.title if lesson and lesson.title not in ("Reading Lesson", "Text Review") else None)
        or quiz_response.title
        or f"Quiz: {extracted_words[0].text if extracted_words else 'Vocabulary'}"
    )
    if len(lesson_title) > 250:
        lesson_title = lesson_title[:250]

    if lesson is None:
        raw_input = raw_text_context or ", ".join(w.text for w in extracted_words)
        lesson_in = LessonCreate(
            source_lang=source_lang,
            target_lang=target_lang,
            title=lesson_title,
            raw_input=raw_input,
            input_type="quiz",
            quiz_data=quiz_response.model_dump(),
            is_completed=False,
        )
        lesson = create_lesson(db, user_id=current_user.id, lesson_in=lesson_in, status="ready")
    else:
        lesson.title = lesson_title
        lesson.input_type = "quiz"
        lesson.status = "ready"
        lesson.quiz_data = json.dumps(quiz_response.model_dump())
        db.commit()
        db.refresh(lesson)

    # Associate words with lesson
    for idx, w in enumerate(extracted_words):
        add_word_to_lesson(db, lesson_id=lesson.id, word_id=w.id, order_index=idx)

    db.refresh(lesson)
    words_read = [WordService.to_read(w, user_id=current_user.id, db=db) for w in extracted_words]

    return LessonRead(
        id=lesson.id,
        user_id=lesson.user_id,
        source_lang=lesson.source_lang,
        target_lang=lesson.target_lang,
        title=lesson.title,
        raw_input=lesson.raw_input,
        input_type=lesson.input_type,
        status=lesson.status,
        is_completed=lesson.is_completed,
        quiz_data=lesson.quiz_data,
        chunk_data=lesson.chunk_data,
        created_at=lesson.created_at,
        updated_at=lesson.updated_at,
        words=words_read,
    )


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
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson or lesson.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lesson with id {lesson_id} not found.",
        )
    lesson.is_completed = request.is_completed
    if request.is_completed:
        lesson.status = "completed"
    db.commit()
    db.refresh(lesson)

    words = [
        WordService.to_read(lw.word, user_id=current_user.id, db=db)
        for lw in lesson.lesson_words
        if lw.word
    ]
    return LessonRead(
        id=lesson.id,
        user_id=lesson.user_id,
        source_lang=lesson.source_lang,
        target_lang=lesson.target_lang,
        title=lesson.title,
        raw_input=lesson.raw_input,
        input_type=lesson.input_type,
        status=lesson.status,
        is_completed=lesson.is_completed,
        quiz_data=lesson.quiz_data,
        chunk_data=lesson.chunk_data,
        created_at=lesson.created_at,
        updated_at=lesson.updated_at,
        words=words,
    )


@router.post(
    "/",
    response_model=TextSubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new lesson from input text via AI",
)
async def create_lesson_endpoint(
    request: TextSubmissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TextSubmissionResponse:
    if not request.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text cannot be empty.",
        )

    active_profile = current_user.get_active_profile()
    job, lesson, words = await job_queue_service.submit_text(
        db=db,
        user_id=current_user.id,
        text=request.text,
        source_lang=request.source_lang or (active_profile.source_language if active_profile else None) or current_user.default_source_lang,
        target_lang=request.target_lang or (active_profile.target_language if active_profile else None) or current_user.default_target_lang,
        wait=request.wait,
    )

    sentence_count = count_sentences(request.text)
    is_multi_sentence = sentence_count > 1

    lesson_read = None
    if lesson:
        lesson_words = [WordService.to_read(w, user_id=current_user.id, db=db) for w in words]
        lesson_read = LessonRead(
            id=lesson.id,
            user_id=lesson.user_id,
            source_lang=lesson.source_lang,
            target_lang=lesson.target_lang,
            title=lesson.title,
            raw_input=lesson.raw_input,
            input_type=lesson.input_type,
            status=lesson.status,
            is_completed=lesson.is_completed,
            quiz_data=lesson.quiz_data,
            chunk_data=lesson.chunk_data,
            created_at=lesson.created_at,
            updated_at=lesson.updated_at,
            words=lesson_words,
        )

    words_read = [WordService.to_read(w, user_id=current_user.id, db=db) for w in words]

    return TextSubmissionResponse(
        job_id=job.id,
        status=job.status,
        is_lesson=lesson is not None,
        is_multi_sentence=is_multi_sentence,
        sentence_count=sentence_count,
        can_create_lesson=is_multi_sentence,
        lesson=lesson_read,
        words=words_read,
        error_message=job.error_message,
    )


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
    deleted = delete_lesson(db, lesson_id=lesson_id, user_id=current_user.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lesson with id {lesson_id} not found.",
        )


