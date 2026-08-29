import React, { useState, useMemo } from 'react';
import { Lesson, Word } from '../types';
import { LessonItem } from './LessonItem';

interface LessonsViewProps {
  words: Word[];
  backendLessons?: Lesson[];
  isLoading?: boolean;
  onSelectLesson: (lesson: Lesson) => void;
  onDeleteLesson?: (lesson: Lesson) => Promise<void> | void;
  onRefresh?: () => void;
}

export function chunkWordsIntoLessons(
  _words: Word[] = [],
  _wordsPerChunk = 5,
  backendLessons: Lesson[] = []
): Lesson[] {
  const lessons: Lesson[] = [];

  // Append any backend named lessons (quiz lessons, revision lessons, saved lessons)
  if (backendLessons && backendLessons.length > 0) {
    backendLessons.forEach((bl, idx) => {
      const num = idx + 1;
      lessons.push({
        ...bl,
        id: bl.id || (1000 + num),
        number: num,
        title: bl.title,
        words: bl.words || [],
        totalWords: bl.words ? bl.words.length : 0,
        targetCount: Math.max(5, bl.words ? bl.words.length : 0),
        isComplete: bl.is_completed || bl.status === 'completed' || (bl.words && bl.words.length >= 5) || bl.status === 'ready',
        is_completed: bl.is_completed || bl.status === 'completed',
        quiz_data: bl.quiz_data,
        input_type: bl.input_type,
        status: bl.status,
      });
    });
  }

  return lessons;
}

export const LessonsView: React.FC<LessonsViewProps> = ({
  words,
  backendLessons = [],
  onSelectLesson,
  onDeleteLesson,
}) => {
  const [openMenuLessonId, setOpenMenuLessonId] = useState<number | null>(null);

  const lessons = useMemo(
    () => chunkWordsIntoLessons(words, 5, backendLessons),
    [words, backendLessons]
  );

  const handleToggleMenu = (lessonId: number) => {
    setOpenMenuLessonId((prev) => (prev === lessonId ? null : lessonId));
  };

  const handleDelete = async (lesson: Lesson) => {
    setOpenMenuLessonId(null);
    if (onDeleteLesson) {
      await onDeleteLesson(lesson);
    }
  };

  return (
    <div id="lessons-view" className="lessons-view lessons-container">
      {/* Lesson Cards Grid */}
      {lessons.length > 0 ? (
        <div id="lessons-grid" className="lessons-grid">
          {lessons.map((lesson) => (
            <LessonItem
              key={lesson.id}
              lesson={lesson}
              isMenuOpen={openMenuLessonId === lesson.id}
              onToggleMenu={handleToggleMenu}
              onDelete={handleDelete}
              onCloseMenu={() => setOpenMenuLessonId(null)}
              onSelectLesson={onSelectLesson}
            />
          ))}
        </div>
      ) : (
        <div id="lessons-empty" className="empty-state lessons-empty">
          <div className="empty-icon">📚</div>
          <h3 className="empty-title">Welcome to Lessons!</h3>
          <p className="empty-desc">
            Add words or submit text using the input bar below to create quiz lessons.
          </p>
          <div className="lesson-welcome-hint">
            <span>💡 Enter words with translations (e.g. <code>hello - привет</code>) or paste sentences to generate quizzes</span>
          </div>
        </div>
      )}
    </div>
  );
};


