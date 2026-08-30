import React, { useRef, useEffect, useState } from 'react';
import { Lesson } from '../types';

interface LessonItemProps {
  lesson: Lesson;
  isMenuOpen: boolean;
  onToggleMenu: (lessonId: number) => void;
  onDelete: (lesson: Lesson) => void;
  onCloseMenu: () => void;
  onSelectLesson: (lesson: Lesson) => void;
}

export const LessonItem: React.FC<LessonItemProps> = ({
  lesson,
  isMenuOpen,
  onToggleMenu,
  onDelete,
  onCloseMenu,
  onSelectLesson,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openUpwards, setOpenUpwards] = useState<boolean>(false);

  const isQuiz = Boolean(
    lesson.quiz_data &&
      ((lesson.quiz_data.questions && lesson.quiz_data.questions.length > 0) ||
        Array.isArray(lesson.quiz_data))
  );
  const isReading = lesson.status === 'reading' || lesson.input_type === 'reading';
  const isRevision = lesson.input_type === 'revision';
  const icon = isRevision ? '🔄' : isQuiz ? '🎯' : isReading ? '📖' : '📚';

  // Check card position to dynamically determine if menu should open upwards
  useEffect(() => {
    if (isMenuOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      // If button is in the bottom half of the viewport or space below is less than 160px
      const spaceBelow = viewportHeight - rect.bottom;
      const shouldOpenUp = spaceBelow < 160 || rect.top > viewportHeight / 2;
      setOpenUpwards(shouldOpenUp);
    }
  }, [isMenuOpen]);

  // Handle clicking outside of open menu
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('touchstart', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [isMenuOpen, onCloseMenu]);

  return (
    <div
      id={`lesson-card-${lesson.number}`}
      data-lesson-id={lesson.id}
      className={`lesson-card ${lesson.is_completed || lesson.isComplete ? 'lesson-card-ready' : 'lesson-card-building'} ${isMenuOpen ? 'menu-active' : ''}`}
      role="button"
      tabIndex={0}
      style={isMenuOpen ? { zIndex: 100 } : undefined}
      aria-label={`Open ${lesson.title} with ${lesson.totalWords} words`}
      onClick={() => onSelectLesson(lesson)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectLesson(lesson);
        }
      }}
    >
      <div className="lesson-card-header">
        <div className="lesson-card-title-group">
          <span className="lesson-icon">{icon}</span>
          <h3 className="lesson-title">{lesson.title}</h3>
        </div>
        <div className="lesson-card-header-right">
          <div className="lesson-card-badges">
            {isRevision ? (
              <span className="lesson-badge badge-revision">Nightly Revision</span>
            ) : isQuiz ? (
              <span className="lesson-badge badge-quiz">Quiz</span>
            ) : isReading ? (
              <span className="lesson-badge badge-reading">Reading</span>
            ) : null}
            <span
              className={`lesson-badge ${lesson.is_completed ? 'badge-completed' : lesson.isComplete || isReading ? 'badge-ready' : 'badge-progress'}`}
            >
              {lesson.is_completed
                ? '✓ Completed'
                : isReading
                ? 'Reading'
                : lesson.isComplete
                ? `${lesson.words?.length || 5} words`
                : `${lesson.totalWords || lesson.words?.length || 0} / 5 words`}
            </span>
          </div>

          {/* Three-dot settings/actions menu */}
          <div
            className={`lesson-actions-wrapper word-actions-wrapper ${isMenuOpen ? 'is-open' : ''}`}
            ref={menuRef}
          >
            <button
              id={`btn-lesson-menu-${lesson.id || lesson.number}`}
              className="btn-lesson-dots-menu btn-word-dots-menu"
              aria-label={`Options for ${lesson.title}`}
              aria-expanded={isMenuOpen}
              onClick={(e) => {
                e.stopPropagation();
                e.currentTarget.blur();
                onToggleMenu(lesson.id);
              }}
            >
              ⋮
            </button>

            {isMenuOpen && (
              <div
                className={`lesson-dropdown-menu word-dropdown-menu ${openUpwards ? 'lesson-dropdown-up word-dropdown-up open-up is-up' : 'lesson-dropdown-down word-dropdown-down'}`}
                role="menu"
              >
                <button
                  id={`btn-delete-lesson-${lesson.id || lesson.number}`}
                  className="lesson-dropdown-item word-dropdown-item dropdown-item-delete"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.currentTarget.blur();
                    onDelete(lesson);
                  }}
                >
                  <span className="dropdown-icon">🗑️</span>
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Words Preview Chips */}
      <div className="lesson-preview-container">
        <div className="lesson-words-preview">
          {(lesson.words || []).map((w) => (
            <span
              key={w.id}
              className="lesson-word-pill"
              title={`${w.text} — ${w.translation}`}
            >
              {w.text}
            </span>
          ))}
        </div>
      </div>

      {/* Progress Bar & Status Indicator */}
      <div className="lesson-card-progress">
        <div className="lesson-progress-bar">
          <div
            className="lesson-progress-fill"
            style={{
              width: lesson.is_completed || isReading
                ? '100%'
                : `${Math.min(100, ((lesson.totalWords || lesson.words?.length || 0) / (lesson.targetCount || 5)) * 100)}%`,
            }}
          />
        </div>
        <span className="lesson-progress-text">
          {lesson.is_completed
            ? 'Completed ✓'
            : isReading
            ? 'Interactive reading & word selection'
            : isQuiz
            ? 'Interactive quiz ready'
            : lesson.isComplete
            ? 'Ready to practice'
            : `${lesson.totalWords || lesson.words?.length || 0} / ${lesson.targetCount || 5} words added`}
        </span>
      </div>

      {/* Card Footer CTA */}
      <div className="lesson-card-footer">
        <span className="lesson-action-cta">
          {isReading ? '▶ Read & Select' : isQuiz ? '▶ Start Quiz' : '▶ Practice Lesson'}
        </span>
        <span className="lesson-arrow">›</span>
      </div>
    </div>
  );
};
