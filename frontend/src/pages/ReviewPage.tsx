import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flashcard } from '../components/Flashcard';
import { SessionSummary } from '../components/SessionSummary';
import { WordAddModal } from '../components/WordAddModal';
import { LoginModal } from '../components/LoginModal';
import { useReviewStore } from '../stores/reviewStore';
import { useLangStore } from '../stores/langStore';
import { useAuthStore } from '../stores/authStore';
import { ArrowLeft, Plus, CheckCircle2, Sparkles, Loader2, Home } from 'lucide-react';

export const ReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { initAuth } = useAuthStore();
  const { targetLang, sourceLang } = useLangStore();
  const {
    dueCards,
    currentIndex,
    isFlipped,
    sessionResults,
    isSessionCompleted,
    isLoading,
    isSubmitting,
    fetchDueReviews,
    flipCard,
    submitRating,
    resetSession,
  } = useReviewStore();

  const [isWordAddOpen, setIsWordAddOpen] = React.useState(false);

  useEffect(() => {
    initAuth();
    if (dueCards.length === 0 && !isSessionCompleted) {
      fetchDueReviews(targetLang);
    }
  }, [dueCards.length, fetchDueReviews, initAuth, isSessionCompleted, targetLang]);

  const totalCards = dueCards.length;
  const currentCard = dueCards[currentIndex];
  const progressPercent =
    totalCards > 0 ? Math.round(((currentIndex) / totalCards) * 100) : 0;

  return (
    <div className="app-container">
      {/* Top Review Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: 'var(--bg-header)',
          borderBottom: '1px solid var(--border-color)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <button
          type="button"
          className="btn-icon"
          onClick={() => navigate('/')}
          aria-label="Back to Dashboard"
          data-testid="review-back-btn"
          style={{ width: '36px', height: '36px' }}
        >
          <ArrowLeft size={18} />
        </button>

        {/* Progress Display */}
        {totalCards > 0 && !isSessionCompleted && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
              padding: '0 16px',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {currentIndex + 1} of {totalCards}
            </span>
            {/* Progress Bar */}
            <div
              style={{
                width: '100%',
                maxWidth: '180px',
                height: '4px',
                backgroundColor: 'var(--border-color)',
                borderRadius: 'var(--radius-full)',
                marginTop: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  backgroundColor: 'var(--color-primary)',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.3s ease-out',
                }}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="badge">
            {sourceLang.toUpperCase()} → {targetLang.toUpperCase()}
          </span>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setIsWordAddOpen(true)}
            aria-label="Add Word"
            data-testid="review-add-word-btn"
            style={{ width: '36px', height: '36px' }}
          >
            <Plus size={16} />
          </button>
        </div>
      </header>

      {/* Main Review Body */}
      <main
        style={{
          flex: 1,
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {isLoading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
            data-testid="review-loading"
          >
            <Loader2 size={32} color="var(--color-primary)" style={{ animation: 'spin-gradient-transform 1s linear infinite' }} />
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Loading review cards...
            </span>
          </div>
        ) : isSessionCompleted || (totalCards > 0 && currentIndex >= totalCards) ? (
          /* Session Completed Summary Screen */
          <SessionSummary
            results={sessionResults}
            onRestart={() => {
              resetSession();
              fetchDueReviews(targetLang);
            }}
          />
        ) : totalCards === 0 ? (
          /* Empty State */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              textAlign: 'center',
              maxWidth: '360px',
            }}
            data-testid="no-reviews-state"
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--srs-easy-bg)',
                color: 'var(--srs-easy)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>
                All Caught Up! 🎉
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                You have no words due for spaced repetition right now. Add some new words to expand your vocabulary!
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsWordAddOpen(true)}
                style={{ gap: '6px' }}
                data-testid="empty-add-word-btn"
              >
                <Plus size={16} />
                <span>Add New Word</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/')}
                style={{ gap: '6px' }}
              >
                <Home size={16} />
                <span>Dashboard</span>
              </button>
            </div>
          </div>
        ) : currentCard ? (
          /* Active Flashcard */
          <div style={{ width: '100%', maxWidth: '440px' }}>
            <Flashcard
              card={currentCard}
              isFlipped={isFlipped}
              onFlip={flipCard}
              onRate={(rating) => submitRating(rating)}
              isSubmitting={isSubmitting}
            />
          </div>
        ) : null}
      </main>

      {/* Modals */}
      <WordAddModal
        isOpen={isWordAddOpen}
        onClose={() => setIsWordAddOpen(false)}
        onSuccess={() => {
          // If queue was empty, refresh
          if (dueCards.length === 0) {
            fetchDueReviews(targetLang);
          }
        }}
      />
      <LoginModal />
    </div>
  );
};
