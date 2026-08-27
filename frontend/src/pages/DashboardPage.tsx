import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { LessonCard } from '../components/LessonCard';
import { InputDock } from '../components/InputDock';
import { WordAddModal } from '../components/WordAddModal';
import { LoginModal } from '../components/LoginModal';
import { useAuthStore } from '../stores/authStore';
import { useLangStore } from '../stores/langStore';
import { useReviewStore } from '../stores/reviewStore';
import { Lesson } from '../types';
import {
  Sparkles,
  Zap,
  BookOpen,
  ArrowRight,
  Plus,
  Clock,
  CheckCircle2,
} from 'lucide-react';

const INITIAL_DEMO_LESSONS: Lesson[] = [
  {
    id: 1,
    source_lang: 'ru',
    target_lang: 'nl',
    title: 'A Conversation at the Amsterdam Cafe',
    raw_input: 'Een kopje koffie alsjeblieft. Met melk en suiker. Hoeveel kost dat?',
    input_type: 'text',
    status: 'ready',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 2,
    source_lang: 'ru',
    target_lang: 'nl',
    title: 'Dutch Everyday Vlogs #42 — Grocery Shopping',
    raw_input: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    input_type: 'youtube',
    status: 'processing', // Shows spinning rainbow animated border!
    created_at: new Date(Date.now() - 600000).toISOString(),
    updated_at: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: 3,
    source_lang: 'en',
    target_lang: 'nl',
    title: 'Essential Dutch Idioms and Slang',
    raw_input: 'Helaas pindakaas! Nu komt de aap uit de mouw.',
    input_type: 'manual',
    status: 'ready',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { initAuth } = useAuthStore();
  const { sourceLang, targetLang, fetchLanguages } = useLangStore();
  const { dueCards, fetchDueReviews, isLoading: isReviewLoading } = useReviewStore();

  const [lessons, setLessons] = useState<Lesson[]>(INITIAL_DEMO_LESSONS);
  const [isWordAddOpen, setIsWordAddOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    initAuth();
    fetchLanguages();
    fetchDueReviews(targetLang);
  }, [fetchDueReviews, fetchLanguages, initAuth, targetLang]);

  const handleLessonSubmit = async (input: string, mode: 'text' | 'youtube') => {
    setIsGenerating(true);

    const title =
      mode === 'youtube'
        ? `YouTube Ingestion (${input.substring(0, 24)}...)`
        : input.length > 30
        ? `${input.substring(0, 30)}...`
        : input;

    const newLesson: Lesson = {
      id: Date.now(),
      source_lang: sourceLang,
      target_lang: targetLang,
      title,
      raw_input: input,
      input_type: mode,
      status: 'processing', // Will trigger spinning rainbow border!
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setLessons((prev) => [newLesson, ...prev]);
    setIsGenerating(false);

    // Simulate backend job processing completion after 7 seconds for demo realism
    setTimeout(() => {
      setLessons((prev) =>
        prev.map((l) => (l.id === newLesson.id ? { ...l, status: 'ready' } : l))
      );
    }, 7000);
  };

  const dueCount = dueCards.length;

  return (
    <div className="app-container">
      <Header onOpenWordAdd={() => setIsWordAddOpen(true)} />

      <main style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Due SRS Review Hero Banner */}
        <section
          style={{
            background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            color: '#ffffff',
            boxShadow: 'var(--shadow-md)',
            position: 'relative',
            overflow: 'hidden',
          }}
          data-testid="srs-due-banner"
        >
          {/* Subtle background glow circle */}
          <div
            style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: '140px',
              height: '140px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                Spaced Repetition
              </span>
              <span style={{ fontSize: '12px', opacity: 0.9 }}>
                {targetLang.toUpperCase()} Vocabulary
              </span>
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '6px' }}>
              {dueCount > 0
                ? `${dueCount} ${dueCount === 1 ? 'Word' : 'Words'} Due for Review`
                : 'All caught up! 🎉'}
            </h2>

            <p style={{ fontSize: '13px', opacity: 0.85, marginBottom: '16px', maxWidth: '340px' }}>
              {dueCount > 0
                ? 'Review these cards to reinforce your memory retention with the SM-2 algorithm.'
                : 'Great job! You have zero cards due. Add more words or generate a lesson below.'}
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              {dueCount > 0 ? (
                <button
                  type="button"
                  onClick={() => navigate('/review')}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#1e40af',
                    fontWeight: 700,
                    padding: '10px 18px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px',
                    gap: '6px',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                  data-testid="start-review-btn"
                >
                  <Zap size={16} fill="#1e40af" />
                  <span>Start Review</span>
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsWordAddOpen(true)}
                  style={{
                    backgroundColor: '#ffffff',
                    color: '#1e40af',
                    fontWeight: 700,
                    padding: '10px 18px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px',
                    gap: '6px',
                  }}
                  data-testid="banner-add-word-btn"
                >
                  <Plus size={16} />
                  <span>Add Word</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Lessons Feed Section */}
        <section>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={18} color="var(--color-primary)" />
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Interactive Lessons</h3>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
            data-testid="lessons-list"
          >
            {lessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                onSelect={(l) => {
                  console.log('Selected lesson:', l);
                }}
              />
            ))}
          </div>
        </section>
      </main>

      {/* Persistent Bottom Input Dock */}
      <InputDock
        onSubmit={handleLessonSubmit}
        onOpenWordAdd={() => setIsWordAddOpen(true)}
        isLoading={isGenerating}
      />

      {/* Modals */}
      <WordAddModal
        isOpen={isWordAddOpen}
        onClose={() => setIsWordAddOpen(false)}
        onSuccess={() => {
          fetchDueReviews(targetLang);
        }}
      />
      <LoginModal />
    </div>
  );
};
