import React, { useMemo } from 'react';
import { Lesson, Word } from '../types';

interface LessonsViewProps {
  words: Word[];
  isLoading?: boolean;
  onSelectLesson: (lesson: Lesson) => void;
  onRefresh?: () => void;
}

export function chunkWordsIntoLessons(words: Word[], wordsPerChunk = 5): Lesson[] {
  if (!words || words.length === 0) return [];
  // Sort stably by ID ascending
  const sorted = [...words].sort((a, b) => a.id - b.id);
  const lessons: Lesson[] = [];
  const totalLessons = Math.ceil(sorted.length / wordsPerChunk);

  for (let i = 0; i < totalLessons; i++) {
    const chunk = sorted.slice(i * wordsPerChunk, (i + 1) * wordsPerChunk);
    lessons.push({
      id: i + 1,
      number: i + 1,
      title: `Lesson ${i + 1}`,
      words: chunk,
      totalWords: chunk.length,
      targetCount: wordsPerChunk,
      isComplete: chunk.length === wordsPerChunk,
    });
  }

  return lessons;
}

export const LessonsView: React.FC<LessonsViewProps> = ({
  words,
  onSelectLesson,
}) => {
  const lessons = useMemo(() => chunkWordsIntoLessons(words, 5), [words]);

  return (
    <div id="lessons-view" className="lessons-view lessons-container">

      {/* Lesson Cards Grid */}
      {lessons.length > 0 ? (
        <div id="lessons-grid" className="lessons-grid">
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              id={`lesson-card-${lesson.number}`}
              className={`lesson-card ${lesson.isComplete ? 'lesson-card-ready' : 'lesson-card-building'}`}
              role="button"
              tabIndex={0}
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
                  <span className="lesson-icon">📚</span>
                  <h3 className="lesson-title">{lesson.title}</h3>
                </div>
                <span
                  className={`lesson-badge ${lesson.isComplete ? 'badge-ready' : 'badge-progress'}`}
                >
                  {lesson.isComplete ? '5 words' : `${lesson.totalWords} / 5 words`}
                </span>
              </div>

              {/* Words Preview Chips */}
              <div className="lesson-preview-container">
                <div className="lesson-words-preview">
                  {lesson.words.map((w) => (
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
                    style={{ width: `${(lesson.totalWords / 5) * 100}%` }}
                  />
                </div>
                <span className="lesson-progress-text">
                  {lesson.isComplete
                    ? 'Ready to practice'
                    : `${lesson.totalWords} / 5 words added`}
                </span>
              </div>

              {/* Card Footer CTA */}
              <div className="lesson-card-footer">
                <span className="lesson-action-cta">▶ Practice Lesson</span>
                <span className="lesson-arrow">›</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div id="lessons-empty" className="empty-state lessons-empty">
          <div className="empty-icon">📚</div>
          <h3 className="empty-title">Welcome to Lessons!</h3>
          <p className="empty-desc">
            Add words using the input bar below to create lessons (5 words per lesson).
          </p>
          <div className="lesson-welcome-hint">
            <span>💡 Enter words with translations (e.g. <code>hello - привет</code>)</span>
          </div>
        </div>
      )}
    </div>
  );
};
