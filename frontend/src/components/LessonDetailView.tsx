import React, { useState, useEffect, useCallback } from 'react';
import { Lesson, Word } from '../types';
import { pronounceWord, triggerHaptic } from '../utils/srs';

interface LessonDetailViewProps {
  lesson: Lesson;
  onClose: () => void;
}

export const LessonDetailView: React.FC<LessonDetailViewProps> = ({
  lesson,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'flashcard' | 'list'>('flashcard');

  const words = lesson.words || [];
  const currentWord: Word | null = words.length > 0 && currentIndex < words.length ? words[currentIndex] : null;

  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
    triggerHaptic('impact');
  }, []);

  const handleAudio = useCallback((e?: React.MouseEvent<HTMLElement>) => {
    if (e) {
      e.stopPropagation();
      e.currentTarget.blur();
    }
    if (currentWord) {
      pronounceWord(currentWord.text, currentWord.language_code || 'en');
      triggerHaptic('impact');
    }
  }, [currentWord]);

  const handleNext = useCallback((e?: React.MouseEvent<HTMLElement>) => {
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
    }
  }, [currentIndex, words.length]);

  const handlePrev = useCallback((e?: React.MouseEvent<HTMLElement>) => {
    if (e) {
      e.stopPropagation();
      e.currentTarget.blur();
    }
    triggerHaptic('impact');
    setIsFlipped(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleRestart = useCallback(() => {
    triggerHaptic('impact');
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsCompleted(false);
  }, []);

  // Keyboard navigation within lesson study
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (viewMode !== 'flashcard' || isCompleted) return;

      const activeEl = document.activeElement;
      if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)) {
        return;
      }

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
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleNext, handlePrev, onClose, viewMode, isCompleted]);

  return (
    <div id="lesson-detail-view" className="lesson-detail-view">
      {/* Top Header Bar with Prominent Close Button */}
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
            <h2 className="lesson-detail-title">{lesson.title}</h2>
            <span className="lesson-detail-meta">
              {words.length} {words.length === 1 ? 'word' : 'words'}
            </span>
          </div>
        </div>

        {/* Study Mode Selector */}
        <div className="lesson-mode-toggle">
          <button
            className={`lesson-mode-btn ${viewMode === 'flashcard' ? 'active' : ''}`}
            onClick={() => setViewMode('flashcard')}
          >
            🎴 Cards
          </button>
          <button
            className={`lesson-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            📋 List
          </button>
        </div>
      </div>

      {/* Progress Bar (Flashcard mode) */}
      {viewMode === 'flashcard' && !isCompleted && words.length > 0 && (
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

      {/* Flashcard Study Mode */}
      {viewMode === 'flashcard' && (
        <>
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
                Great job! You've reviewed all {words.length} words in {lesson.title}.
              </p>
              <div className="lesson-completed-actions">
                <button
                  id="btn-restart-lesson"
                  className="btn btn-primary"
                  onClick={handleRestart}
                >
                  🔄 Practice Again
                </button>
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

      {/* List Study Mode */}
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
            <button
              className="btn btn-primary btn-full"
              onClick={() => {
                setViewMode('flashcard');
                setCurrentIndex(0);
                setIsCompleted(false);
              }}
            >
              ▶ Practice as Flashcards
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
