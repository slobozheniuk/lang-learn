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
from app.schemas.job import TextSubmissionRequest, TextSubmissionResponse
from app.schemas.lesson import (
    ChunkItem,
    LessonChunkRequest,
    LessonChunkResponse,
    LessonCreate,
    LessonCompleteRequest,
    LessonPrepareRequest,
    LessonQuizGenerateRequest,
    LessonRead,
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
        created_at=lesson.created_at,
        updated_at=lesson.updated_at,
        words=words,
    )


@router.post(
    "/chunk-text",
    response_model=LessonChunkResponse,
    summary="Chunk input text into interactive selectable tokens",
)
async def chunk_text_endpoint(
    request: LessonChunkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LessonChunkResponse:
    if not request.text.strip():
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

    chunk_res = await job_queue_service.llm.chunk_text(
        text=request.text,
        source_lang=source_lang,
        target_lang=target_lang,
    )

    chunks = [
        ChunkItem(
            text=c.text,
            is_selectable=c.is_selectable,
            lemma=c.lemma,
        )
        for c in chunk_res.chunks
    ]

    return LessonChunkResponse(
        title=chunk_res.title,
        chunks=chunks,
    )


@router.post(
    "/prepare",
    response_model=LessonRead,
    status_code=status.HTTP_201_CREATED,
    summary="Prepare lesson from selected unknown words/phrases after text review",
)
async def prepare_lesson_endpoint(
    request: LessonPrepareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LessonRead:
    if not request.selected_words:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one word or phrase must be selected.",
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

    created_words = []
    # Translate and extract each selected word or phrase
    for sel_word in request.selected_words:
        extracted = await job_queue_service.llm.extract_vocabulary(
            text=sel_word,
            source_lang=source_lang,
            target_lang=target_lang,
        )
        items = extracted.items
        if not items:
            items = [
                WordRead(
                    id=0,
                    language_code=target_lang,
                    text=sel_word,
                    translation=sel_word,
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
            if target_word not in created_words:
                created_words.append(target_word)

    # Generate quiz lesson specifically from the selected words
    words_data = [
        {
            "text": w.text,
            "translation": w.translation,
            "pos": w.pos,
            "phonetic": w.phonetic,
            "context_phrase": w.context_phrase,
        }
        for w in created_words
    ]

    quiz_response = await job_queue_service.llm.generate_quiz(
        words=words_data,
        source_lang=source_lang,
        target_lang=target_lang,
        text=request.text,
        title=request.title,
    )

    lesson_title = request.title or quiz_response.title or f"Lesson: {created_words[0].text if created_words else 'Vocabulary'}"
    if len(lesson_title) > 250:
        lesson_title = lesson_title[:250]

    raw_input = request.text or ", ".join(w.text for w in created_words)
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

    for idx, w in enumerate(created_words):
        add_word_to_lesson(db, lesson_id=lesson.id, word_id=w.id, order_index=idx)

    words_read = [WordService.to_read(w, user_id=current_user.id, db=db) for w in created_words]
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
        created_at=lesson.created_at,
        updated_at=lesson.updated_at,
        words=words_read,
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


