import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChunkItem, Lesson, QuizQuestion, Word } from '../types';
import { chunkText, completeLesson, prepareLesson } from '../api';
import { pronounceWord, triggerHaptic } from '../utils/srs';

interface LessonDetailViewProps {
  lesson: Lesson;
  onClose: () => void;
  onLessonCompleted?: (lessonId: number) => void;
  onLessonPrepared?: (updatedLesson: Lesson) => void;
}

export const LessonDetailView: React.FC<LessonDetailViewProps> = ({
  lesson,
  onClose,
  onLessonCompleted,
  onLessonPrepared,
}) => {
  const [currentLesson, setCurrentLesson] = useState<Lesson>(lesson);

  useEffect(() => {
    setCurrentLesson(lesson);
  }, [lesson]);

  const quizQuestions: QuizQuestion[] = useMemo(() => {
    if (!currentLesson.quiz_data) return [];
    let qData = currentLesson.quiz_data;
    if (typeof qData === 'string') {
      try {
        qData = JSON.parse(qData);
      } catch {
        return [];
      }
    }
    if (Array.isArray(qData)) return qData;
    if (qData && Array.isArray(qData.questions)) return qData.questions;
    return [];
  }, [currentLesson.quiz_data]);

  const hasQuiz = quizQuestions.length > 0;
  const isReadingLesson = currentLesson.status === 'reading' || currentLesson.input_type === 'reading';
  const hasRawText = Boolean(currentLesson.raw_input && currentLesson.raw_input.trim().length > 0);
  const hasReading = Boolean(currentLesson.chunk_data || hasRawText || isReadingLesson);

  // Study View Mode: default to reading if reading lesson, quiz if quiz exists, else flashcard
  const [viewMode, setViewMode] = useState<'reading' | 'quiz' | 'flashcard' | 'list'>(() => {
    if (isReadingLesson) return 'reading';
    if (hasQuiz) return 'quiz';
    if (hasReading && (!currentLesson.words || currentLesson.words.length === 0)) return 'reading';
    return 'flashcard';
  });

  // Interactive Reading State
  const [chunks, setChunks] = useState<ChunkItem[]>(() => {
    if (currentLesson.chunk_data) {
      let cData = currentLesson.chunk_data;
      if (typeof cData === 'string') {
        try {
          cData = JSON.parse(cData);
        } catch {
          cData = null;
        }
      }
      if (Array.isArray(cData)) return cData;
      if (cData && Array.isArray(cData.chunks)) return cData.chunks;
    }
    return [];
  });
  const [isChunking, setIsChunking] = useState<boolean>(false);
  const [selectedChunkIndices, setSelectedChunkIndices] = useState<Set<number>>(new Set());
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  // Load chunks if needed
  useEffect(() => {
    if (chunks.length > 0) return;
    if (currentLesson.raw_input && currentLesson.raw_input.trim()) {
      setIsChunking(true);
      chunkText({
        text: currentLesson.raw_input,
        source_lang: currentLesson.source_lang,
        target_lang: currentLesson.target_lang,
      })
        .then((res) => {
          if (res && Array.isArray(res.chunks)) {
            setChunks(res.chunks);
          }
        })
        .catch((err) => {
          console.warn('Failed to chunk text:', err);
        })
        .finally(() => {
          setIsChunking(false);
        });
    }
  }, [currentLesson.raw_input, currentLesson.source_lang, currentLesson.target_lang, chunks.length]);

  // Flashcard Mode State
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Quiz Mode State
  const [quizIndex, setQuizIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizScore, setQuizScore] = useState<number>(0);
  const [isQuizCompleted, setIsQuizCompleted] = useState<boolean>(false);

  const words = currentLesson.words || [];
  const currentWord: Word | null =
    words.length > 0 && currentIndex < words.length ? words[currentIndex] : null;

  const currentQuizQuestion: QuizQuestion | null =
    hasQuiz && quizIndex < quizQuestions.length ? quizQuestions[quizIndex] : null;

  // Toggle chunk selection
  const toggleChunk = useCallback((chunk: ChunkItem, index: number) => {
    const isSelectable = Boolean(chunk.is_selectable ?? chunk.is_word ?? true);
    if (!isSelectable) return;

    triggerHaptic('impact');
    setSelectedChunkIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Prepare Lesson from Selected Chunks
  const handlePrepareLesson = useCallback(async () => {
    if (selectedChunkIndices.size === 0 || isPreparing) return;

    setIsPreparing(true);
    setPrepareError(null);
    triggerHaptic('impact');

    const selectedList = Array.from(selectedChunkIndices)
      .sort((a, b) => a - b)
      .map((idx) => chunks[idx])
      .filter(Boolean);
    const selectedWords = selectedList.map((c) => c.text);

    try {
      const updated = await prepareLesson(currentLesson.id, {
        selected_chunks: selectedList,
        selected_words: selectedWords,
        text: currentLesson.raw_input,
        title: currentLesson.title,
        source_lang: currentLesson.source_lang,
        target_lang: currentLesson.target_lang,
      });

      triggerHaptic('success');
      setCurrentLesson(updated);
      if (onLessonPrepared) {
        onLessonPrepared(updated);
      }
      setViewMode('quiz');
      setQuizIndex(0);
      setSelectedAnswers({});
      setQuizScore(0);
      setIsQuizCompleted(false);
    } catch (err: any) {
      triggerHaptic('error');
      setPrepareError(err?.message || 'Failed to prepare lesson from selected words');
      console.error('Failed to prepare lesson:', err);
    } finally {
      setIsPreparing(false);
    }
  }, [selectedChunkIndices, isPreparing, chunks, currentLesson, onLessonPrepared]);

  // Flashcard handlers
  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
    triggerHaptic('impact');
  }, []);

  const handleAudio = useCallback(
    (e?: React.MouseEvent<HTMLElement>) => {
      if (e) {
        e.stopPropagation();
        e.currentTarget.blur();
      }
      if (currentWord) {
        pronounceWord(currentWord.text, currentWord.language_code || 'en');
        triggerHaptic('impact');
      }
    },
    [currentWord]
  );

  const handleNext = useCallback(
    (e?: React.MouseEvent<HTMLElement>) => {
      if (e) {
        e.stopPropagation();
        e.currentTarget.blur();
      }
      triggerHaptic('success');
      setIsFlipped(false);
      if (currentIndex + 1 < words.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setIsCompleted(true);
        if (lesson.id) {
          completeLesson(lesson.id, { is_completed: true }).catch(console.warn);
          if (onLessonCompleted) onLessonCompleted(lesson.id);
        }
      }
    },
    [currentIndex, words.length, lesson.id, onLessonCompleted]
  );

  const handlePrev = useCallback(
    (e?: React.MouseEvent<HTMLElement>) => {
      if (e) {
        e.stopPropagation();
        e.currentTarget.blur();
      }
      triggerHaptic('impact');
      setIsFlipped(false);
      if (currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
      }
    },
    [currentIndex]
  );

  const handleRestart = useCallback(() => {
    triggerHaptic('impact');
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsCompleted(false);
  }, []);

  // Quiz handlers
  const handleSelectQuizOption = useCallback(
    (optIdx: number) => {
      if (!currentQuizQuestion || selectedAnswers[quizIndex] !== undefined) return;

      const correctIdx =
        currentQuizQuestion.correct_index !== undefined
          ? currentQuizQuestion.correct_index
          : currentQuizQuestion.correct_option_index !== undefined
          ? currentQuizQuestion.correct_option_index
          : 0;

      const isCorrect = optIdx === correctIdx;
      if (isCorrect) {
        triggerHaptic('success');
        setQuizScore((prev) => prev + 1);
      } else {
        triggerHaptic('error');
      }

      setSelectedAnswers((prev) => ({
        ...prev,
        [quizIndex]: optIdx,
      }));
    },
    [currentQuizQuestion, quizIndex, selectedAnswers]
  );

  const handleNextQuizQuestion = useCallback(() => {
    triggerHaptic('impact');
    if (quizIndex + 1 < quizQuestions.length) {
      setQuizIndex((prev) => prev + 1);
    } else {
      setIsQuizCompleted(true);
      if (lesson.id) {
        completeLesson(lesson.id, {
          is_completed: true,
          score: quizScore,
          total: quizQuestions.length,
        }).catch(console.warn);
        if (onLessonCompleted) onLessonCompleted(lesson.id);
      }
    }
  }, [quizIndex, quizQuestions.length, lesson.id, quizScore, onLessonCompleted]);

  const handleRestartQuiz = useCallback(() => {
    triggerHaptic('impact');
    setQuizIndex(0);
    setSelectedAnswers({});
    setQuizScore(0);
    setIsQuizCompleted(false);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      const activeEl = document.activeElement;
      if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)) {
        return;
      }

      if (viewMode === 'quiz' && !isQuizCompleted && currentQuizQuestion) {
        const key = e.key.toLowerCase();
        if (['1', '2', '3', '4'].includes(key)) {
          const optIdx = parseInt(key, 10) - 1;
          if (optIdx >= 0 && optIdx < currentQuizQuestion.options.length) {
            e.preventDefault();
            handleSelectQuizOption(optIdx);
          }
        } else if (['a', 'b', 'c', 'd'].includes(key)) {
          const optIdx = { a: 0, b: 1, c: 2, d: 3 }[key];
          if (optIdx !== undefined && optIdx < currentQuizQuestion.options.length) {
            e.preventDefault();
            handleSelectQuizOption(optIdx);
          }
        } else if ((e.key === 'Enter' || e.code === 'Space') && selectedAnswers[quizIndex] !== undefined) {
          e.preventDefault();
          handleNextQuizQuestion();
        }
      } else if (viewMode === 'flashcard' && !isCompleted) {
        if (e.code === 'Space') {
          e.preventDefault();
          handleFlip();
        } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
          e.preventDefault();
          handleNext();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrev();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleFlip,
    handleNext,
    handlePrev,
    handleSelectQuizOption,
    handleNextQuizQuestion,
    onClose,
    viewMode,
    isCompleted,
    isQuizCompleted,
    currentQuizQuestion,
    quizIndex,
    selectedAnswers,
  ]);

  return (
    <div id="lesson-detail-view" className="lesson-detail-view">
      {/* Top Header Bar */}
      <div className="lesson-detail-header">
        <div className="lesson-detail-header-left">
          <button
            id="btn-close-lesson"
            className="btn-close-lesson"
            onClick={onClose}
            aria-label="Close lesson and back to Lessons"
            title="Back to Lessons"
          >
            ✕
          </button>
          <div className="lesson-detail-titles">
            <h2 className="lesson-detail-title">{currentLesson.title}</h2>
            <span className="lesson-detail-meta">
              {viewMode === 'reading' && '📖 Reading & Selection Mode'}
              {viewMode === 'quiz' && `${quizQuestions.length} quiz questions • `}
              {viewMode !== 'reading' && `${words.length} ${words.length === 1 ? 'word' : 'words'}`}
            </span>
          </div>
        </div>

        {/* Study Mode Selector */}
        <div className="lesson-mode-toggle">
          {hasReading && (
            <button
              id="btn-mode-reading"
              className={`lesson-mode-btn ${viewMode === 'reading' ? 'active' : ''}`}
              onClick={() => setViewMode('reading')}
            >
              📖 Read
            </button>
          )}
          {hasQuiz && (
            <button
              id="btn-mode-quiz"
              className={`lesson-mode-btn ${viewMode === 'quiz' ? 'active' : ''}`}
              onClick={() => setViewMode('quiz')}
            >
              🎯 Quiz
            </button>
          )}
          <button
            id="btn-mode-cards"
            className={`lesson-mode-btn ${viewMode === 'flashcard' ? 'active' : ''}`}
            onClick={() => setViewMode('flashcard')}
          >
            🎴 Cards
          </button>
          <button
            id="btn-mode-list"
            className={`lesson-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            📋 List
          </button>
        </div>
      </div>

      {/* ======================================================================
          INTERACTIVE READING & CHUNK SELECTION MODE
         ====================================================================== */}
      {viewMode === 'reading' && (
        <div id="reading-study-container" className="reading-study-container">
          <div className="reading-card-header">
            <div className="reading-header-icon">📖</div>
            <div className="reading-header-text">
              <h3 className="reading-header-title">Interactive Reading</h3>
              <p className="reading-header-subtitle">
                Tap words or phrases you want to practice to highlight them.
              </p>
            </div>
          </div>

          {prepareError && (
            <div className="reading-error-banner">
              ⚠️ {prepareError}
            </div>
          )}

          {isChunking ? (
            <div id="reading-loading" className="reading-loading-state">
              <span className="reading-spinner">⏳</span>
              <span>Analyzing and chunking text with AI...</span>
            </div>
          ) : (
            <div id="interactive-reading-card" className="interactive-reading-card">
              <div className="reading-text-flow" role="region" aria-label="Interactive reading text">
                {chunks.map((chunk, idx) => {
                  const isSelectable = Boolean(chunk.is_selectable ?? chunk.is_word ?? true);
                  const isSelected = selectedChunkIndices.has(idx);

                  if (!isSelectable) {
                    return (
                      <span key={idx} id={`chunk-${idx}`} className="reading-chunk-plain">
                        {chunk.text}
                      </span>
                    );
                  }

                  return (
                    <span
                      key={idx}
                      id={`chunk-${idx}`}
                      role="button"
                      tabIndex={0}
                      className={`reading-chunk-chip ${isSelected ? 'chunk-highlighted is-selected selected' : ''}`}
                      onClick={() => toggleChunk(chunk, idx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleChunk(chunk, idx);
                        }
                      }}
                      aria-pressed={isSelected}
                      title={chunk.translation ? `${chunk.text} (${chunk.translation})` : chunk.text}
                    >
                      {chunk.text}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom Floating/Sticky Action Bar */}
          <div id="reading-action-bar" className="reading-action-bar">
            <div className="reading-counter-badge">
              <span id="selected-chunks-count" className="selected-chunks-count">
                {selectedChunkIndices.size} {selectedChunkIndices.size === 1 ? 'word' : 'words'} selected
              </span>
            </div>
            <button
              id="btn-prepare-lesson"
              className="btn btn-primary btn-full btn-prepare-lesson"
              disabled={selectedChunkIndices.size === 0 || isPreparing}
              onClick={handlePrepareLesson}
            >
              {isPreparing
                ? '⏳ Preparing Lesson & Quiz...'
                : `Prepare Lesson (${selectedChunkIndices.size} ${selectedChunkIndices.size === 1 ? 'word' : 'words'} selected)`}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================================
          QUIZ STUDY MODE
         ====================================================================== */}
      {viewMode === 'quiz' && hasQuiz && (
        <div id="quiz-study-container" className="quiz-study-container">
          {!isQuizCompleted && currentQuizQuestion ? (
            <>
              {/* Progress Bar & Counter */}
              <div className="lesson-detail-progress-wrapper">
                <div className="lesson-detail-progress-track">
                  <div
                    className="lesson-detail-progress-fill"
                    style={{
                      width: `${((quizIndex + 1) / quizQuestions.length) * 100}%`,
                    }}
                  />
                </div>
                <div className="quiz-header-counter">
                  <span>Question {quizIndex + 1} of {quizQuestions.length}</span>
                  <span className="quiz-live-score">Score: {quizScore}</span>
                </div>
              </div>

              {/* Question Card */}
              <div className="quiz-question-card">
                <div className="quiz-question-header">
                  <span className="quiz-badge-icon">❓</span>
                  <h3 className="quiz-question-text">{currentQuizQuestion.question}</h3>
                </div>

                {/* Multiple-Choice Options */}
                <div className="quiz-options-list" role="group" aria-label="Answer options">
                  {currentQuizQuestion.options.map((option, optIdx) => {
                    const isSelected = selectedAnswers[quizIndex] === optIdx;
                    const isAnswered = selectedAnswers[quizIndex] !== undefined;
                    const correctIdx =
                      currentQuizQuestion.correct_index !== undefined
                        ? currentQuizQuestion.correct_index
                        : currentQuizQuestion.correct_option_index !== undefined
                        ? currentQuizQuestion.correct_option_index
                        : 0;
                    const isCorrectOption = optIdx === correctIdx;

                    let optClass = 'quiz-option-btn';
                    if (isAnswered) {
                      if (isCorrectOption) {
                        optClass += ' quiz-option-correct';
                      } else if (isSelected && !isCorrectOption) {
                        optClass += ' quiz-option-wrong';
                      } else {
                        optClass += ' quiz-option-dimmed';
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        id={`quiz-option-${optIdx}`}
                        className={optClass}
                        disabled={isAnswered}
                        onClick={() => handleSelectQuizOption(optIdx)}
                        aria-pressed={isSelected}
                      >
                        <span className="quiz-opt-letter">
                          {['A', 'B', 'C', 'D'][optIdx] || optIdx + 1}
                        </span>
                        <span className="quiz-opt-text">{option}</span>
                        {isAnswered && isCorrectOption && (
                          <span className="quiz-opt-badge correct">✓</span>
                        )}
                        {isAnswered && isSelected && !isCorrectOption && (
                          <span className="quiz-opt-badge wrong">✗</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Instant Feedback & Explanation */}
                {selectedAnswers[quizIndex] !== undefined && (
                  <div
                    className={`quiz-feedback-box ${
                      selectedAnswers[quizIndex] ===
                      (currentQuizQuestion.correct_index !== undefined
                        ? currentQuizQuestion.correct_index
                        : currentQuizQuestion.correct_option_index || 0)
                        ? 'feedback-correct'
                        : 'feedback-wrong'
                    }`}
                  >
                    <div className="quiz-feedback-header">
                      {selectedAnswers[quizIndex] ===
                      (currentQuizQuestion.correct_index !== undefined
                        ? currentQuizQuestion.correct_index
                        : currentQuizQuestion.correct_option_index || 0) ? (
                        <span>✓ Correct! Great job!</span>
                      ) : (
                        <span>✗ Incorrect</span>
                      )}
                    </div>
                    {currentQuizQuestion.explanation && (
                      <p className="quiz-explanation">{currentQuizQuestion.explanation}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Next / Finish Question Action */}
              <div className="quiz-action-bar">
                <button
                  id="btn-next-quiz-question"
                  className="btn btn-primary btn-full"
                  disabled={selectedAnswers[quizIndex] === undefined}
                  onClick={handleNextQuizQuestion}
                >
                  {quizIndex + 1 === quizQuestions.length ? 'Finish Quiz ✓' : 'Next Question ›'}
                </button>
              </div>
            </>
          ) : (
            /* Quiz Completed Stats Screen */
            <div id="quiz-completed-state" className="empty-state quiz-completed-card">
              <div className="empty-icon">🎯</div>
              <h3 className="empty-title">Quiz Completed!</h3>
              <div className="quiz-score-badge">
                <span className="quiz-score-num">{quizScore}</span>
                <span className="quiz-score-total">/ {quizQuestions.length}</span>
                <span className="quiz-score-percent">
                  ({Math.round((quizScore / quizQuestions.length) * 100)}%)
                </span>
              </div>
              <p className="empty-desc">
                {quizScore === quizQuestions.length
                  ? 'Outstanding! Perfect score! 🌟'
                  : quizScore / quizQuestions.length >= 0.8
                  ? 'Excellent job! Great vocabulary mastery! 👏'
                  : quizScore / quizQuestions.length >= 0.5
                  ? 'Good effort! Review the words to strengthen your memory! 📚'
                  : 'Keep practicing! Review words and try again to improve! 💪'}
              </p>

              <div className="quiz-completed-actions">
                <button
                  id="btn-restart-quiz"
                  className="btn btn-primary"
                  onClick={handleRestartQuiz}
                >
                  🔄 Retake Quiz
                </button>
                <button
                  id="btn-quiz-to-cards"
                  className="btn btn-outline"
                  onClick={() => {
                    setViewMode('flashcard');
                    setCurrentIndex(0);
                    setIsCompleted(false);
                  }}
                >
                  🎴 Review as Flashcards
                </button>
                <button
                  id="btn-finish-quiz-back"
                  className="btn btn-outline"
                  onClick={onClose}
                >
                  Back to Lessons
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================================
          FLASHCARD STUDY MODE
         ====================================================================== */}
      {viewMode === 'flashcard' && (
        <>
          {/* Progress Bar (Flashcard mode) */}
          {!isCompleted && words.length > 0 && (
            <div className="lesson-detail-progress-wrapper">
              <div className="lesson-detail-progress-track">
                <div
                  className="lesson-detail-progress-fill"
                  style={{
                    width: `${((currentIndex + 1) / words.length) * 100}%`,
                  }}
                />
              </div>
              <div className="lesson-detail-counter">
                Card {currentIndex + 1} of {words.length}
              </div>
            </div>
          )}

          {!isCompleted && currentWord ? (
            <div className="lesson-study-container">
              {/* 3D Interactive Card */}
              <div className="flashcard-scene">
                <div
                  id="lesson-flashcard"
                  className={`flashcard ${isFlipped ? 'is-flipped flipped' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label="Lesson Card. Tap to flip"
                  onClick={handleFlip}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleFlip();
                    }
                  }}
                >
                  {/* Front Face */}
                  <div className="card-face card-face-front">
                    <div className="card-main-content">
                      <div className="card-word">{currentWord.text}</div>
                      <div className="card-phonetic">
                        {currentWord.phonetic
                          ? `[${currentWord.phonetic}]`
                          : currentWord.pos
                          ? `(${currentWord.pos})`
                          : ''}
                      </div>
                    </div>
                    <div className="card-bottom-hint">
                      <span>👆 Tap card to flip and reveal translation</span>
                    </div>
                  </div>

                  {/* Back Face */}
                  <div className="card-face card-face-back">
                    <div className="card-main-content">
                      <div className="card-translation">{currentWord.translation}</div>
                      {currentWord.context_phrase && (
                        <div className="card-context">"{currentWord.context_phrase}"</div>
                      )}
                    </div>
                    <div className="card-bottom-hint">
                      <span>Tap card again to flip back</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action & Navigation Controls */}
              <div className="lesson-controls-bar">
                <button
                  id="btn-lesson-prev"
                  className="btn btn-outline btn-lesson-nav"
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  aria-label="Previous card"
                  title="Previous card"
                >
                  ‹ Prev
                </button>

                <button
                  id="btn-lesson-audio"
                  className="srs-btn srs-btn-audio"
                  onClick={handleAudio}
                  aria-label="Pronounce word"
                  title="Pronounce word"
                >
                  <span className="srs-btn-icon">🔊</span>
                </button>

                <button
                  id="btn-lesson-next"
                  className="btn btn-primary btn-lesson-nav"
                  onClick={handleNext}
                  aria-label={currentIndex + 1 === words.length ? 'Finish lesson' : 'Next card'}
                  title={currentIndex + 1 === words.length ? 'Finish lesson' : 'Next card'}
                >
                  {currentIndex + 1 === words.length ? 'Finish ✓' : 'Next ›'}
                </button>
              </div>
            </div>
          ) : (
            /* Lesson Completed Celebration View */
            <div id="lesson-completed-state" className="empty-state lesson-completed-card">
              <div className="empty-icon">🎉</div>
              <h3 className="empty-title">Lesson Completed!</h3>
              <p className="empty-desc">
                Great job! You've reviewed all {words.length} words in {currentLesson.title}.
              </p>
              <div className="lesson-completed-actions">
                <button
                  id="btn-restart-lesson"
                  className="btn btn-primary"
                  onClick={handleRestart}
                >
                  🔄 Practice Again
                </button>
                {hasQuiz && (
                  <button
                    id="btn-lesson-to-quiz"
                    className="btn btn-outline"
                    onClick={() => {
                      setViewMode('quiz');
                      handleRestartQuiz();
                    }}
                  >
                    🎯 Take Quiz
                  </button>
                )}
                {hasReading && (
                  <button
                    id="btn-cards-to-reading"
                    className="btn btn-outline"
                    onClick={() => setViewMode('reading')}
                  >
                    📖 Read Text
                  </button>
                )}
                <button
                  id="btn-finish-lesson"
                  className="btn btn-outline"
                  onClick={onClose}
                >
                  Back to Lessons
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================================
          LIST STUDY MODE
         ====================================================================== */}
      {viewMode === 'list' && (
        <div className="lesson-list-mode">
          <div className="lesson-words-grid">
            {words.map((w, index) => (
              <div key={w.id} className="lesson-list-item">
                <div className="lesson-list-number">{index + 1}</div>
                <div className="lesson-list-details">
                  <div className="lesson-list-text-row">
                    <strong className="lesson-list-word">{w.text}</strong>
                    {w.phonetic && <span className="lesson-list-phonetic">[{w.phonetic}]</span>}
                    {w.pos && <span className="word-pos-tag">{w.pos}</span>}
                  </div>
                  <div className="lesson-list-trans">{w.translation}</div>
                  {w.context_phrase && (
                    <div className="word-context-phrase">"{w.context_phrase}"</div>
                  )}
                </div>
                <button
                  className="btn-audio-small"
                  aria-label={`Pronounce ${w.text}`}
                  title="Pronounce"
                  onClick={() => {
                    pronounceWord(w.text, w.language_code || 'en');
                    triggerHaptic('impact');
                  }}
                >
                  🔊
                </button>
              </div>
            ))}
          </div>

          <div className="lesson-list-footer">
            {hasQuiz && (
              <button
                className="btn btn-primary btn-full"
                onClick={() => {
                  setViewMode('quiz');
                  handleRestartQuiz();
                }}
              >
                🎯 Start Interactive Quiz
              </button>
            )}
            <button
              className="btn btn-outline btn-full"
              onClick={() => {
                setViewMode('flashcard');
                setCurrentIndex(0);
                setIsCompleted(false);
              }}
            >
              🎴 Practice as Flashcards
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

