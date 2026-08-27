import React, { useEffect } from 'react';
import { DueWordItem, SRSRating } from '../types';
import { Volume2, RotateCw, Sparkles, BookOpen, Clock } from 'lucide-react';
import { playPronunciation } from '../utils/audio';

interface FlashcardProps {
  card: DueWordItem;
  isFlipped: boolean;
  onFlip: () => void;
  onRate: (rating: SRSRating) => void;
  isSubmitting?: boolean;
}

export const Flashcard: React.FC<FlashcardProps> = ({
  card,
  isFlipped,
  onFlip,
  onRate,
  isSubmitting = false,
}) => {
  const { word, stats, is_new } = card;

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        onFlip();
      } else if (isFlipped && !isSubmitting) {
        if (e.key === '1') {
          onRate('again');
        } else if (e.key === '2') {
          onRate('hard');
        } else if (e.key === '3') {
          onRate('good');
        } else if (e.key === '4') {
          onRate('easy');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, isSubmitting, onFlip, onRate]);

  const handleAudioPlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    playPronunciation(word.text, word.language_code, word.audio_url);
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 3D Flipping Card Scene */}
      <div className="flashcard-scene" onClick={onFlip} data-testid="flashcard-scene">
        <div
          className={`flashcard-card ${isFlipped ? 'is-flipped' : ''}`}
          data-testid="flashcard-element"
        >
          {/* FRONT FACE */}
          <div className="flashcard-face flashcard-face-front" data-testid="flashcard-front">
            {/* Top Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span className="badge badge-primary">{word.language_code.toUpperCase()}</span>
                {word.pos && <span className="badge">{word.pos}</span>}
              </div>

              {is_new ? (
                <span className="badge badge-warning">
                  <Sparkles size={12} />
                  <span>New</span>
                </span>
              ) : stats ? (
                <span className="badge" style={{ gap: '4px' }}>
                  <Clock size={12} />
                  <span>Rep {stats.repetition_number}</span>
                </span>
              ) : null}
            </div>

            {/* Middle: Target Word & Phonetics */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px 0',
                gap: '8px',
                textAlign: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1
                  style={{
                    fontSize: '32px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: 'var(--text-primary)',
                  }}
                  data-testid="card-front-word"
                >
                  {word.text}
                </h1>
                <button
                  type="button"
                  onClick={handleAudioPlay}
                  className="btn-icon"
                  style={{ width: '36px', height: '36px', color: 'var(--color-primary)' }}
                  title="Pronounce word"
                  aria-label="Pronounce"
                  data-testid="audio-btn-front"
                >
                  <Volume2 size={18} />
                </button>
              </div>

              {word.phonetic && (
                <span
                  style={{
                    fontSize: '15px',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  /{word.phonetic}/
                </span>
              )}
            </div>

            {/* Bottom Hint */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '13px',
                color: 'var(--text-muted)',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-color-subtle)',
              }}
            >
              <RotateCw size={14} />
              <span>Tap or press Space to reveal</span>
            </div>
          </div>

          {/* BACK FACE */}
          <div className="flashcard-face flashcard-face-back" data-testid="flashcard-back">
            {/* Top Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span className="badge badge-primary">{word.language_code.toUpperCase()}</span>
                {word.lemma && word.lemma !== word.text && (
                  <span className="badge">base: {word.lemma}</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleAudioPlay}
                className="btn-icon"
                style={{ width: '32px', height: '32px', color: 'var(--color-primary)' }}
                title="Pronounce word"
                aria-label="Pronounce"
                data-testid="audio-btn-back"
              >
                <Volume2 size={16} />
              </button>
            </div>

            {/* Middle: Translation & Context Phrase */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 0',
                gap: '12px',
                textAlign: 'center',
              }}
            >
              <h2
                style={{
                  fontSize: '26px',
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                }}
                data-testid="card-back-translation"
              >
                {word.translation || 'No translation provided'}
              </h2>

              {word.context_phrase && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    fontSize: '14px',
                    color: 'var(--text-primary)',
                    fontStyle: 'italic',
                    border: '1px solid var(--border-color-subtle)',
                    maxWidth: '100%',
                  }}
                  data-testid="card-back-context"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'normal', fontWeight: 600 }}>
                    <BookOpen size={12} />
                    <span>EXAMPLE</span>
                  </div>
                  "{word.context_phrase}"
                </div>
              )}
            </div>

            {/* Bottom: Word Stats info */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: 'var(--text-muted)',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-color-subtle)',
              }}
            >
              <span>Interval: {stats ? `${stats.interval_days}d` : 'New'}</span>
              <span>Ease: {stats ? stats.ease_factor.toFixed(2) : '2.50'}</span>
              <span>Recalls: {stats ? `${stats.recall_count}` : '0'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 SRS Response Buttons (Revealed when card is flipped) */}
      {isFlipped ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            animation: 'fadeIn 0.25s ease-out',
          }}
          data-testid="srs-rating-buttons"
        >
          {/* Rating 1: Again */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onRate('again')}
            data-testid="rating-again-btn"
            style={{
              backgroundColor: 'var(--srs-again-bg)',
              color: 'var(--srs-again)',
              border: '1.5px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 700,
            }}
          >
            <span style={{ fontSize: '14px' }}>Again</span>
            <span style={{ fontSize: '11px', opacity: 0.8, fontWeight: 500 }}>&lt;1m (1)</span>
          </button>

          {/* Rating 2: Hard */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onRate('hard')}
            data-testid="rating-hard-btn"
            style={{
              backgroundColor: 'var(--srs-hard-bg)',
              color: 'var(--srs-hard)',
              border: '1.5px solid rgba(245, 158, 11, 0.4)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 700,
            }}
          >
            <span style={{ fontSize: '14px' }}>Hard</span>
            <span style={{ fontSize: '11px', opacity: 0.8, fontWeight: 500 }}>1d (2)</span>
          </button>

          {/* Rating 3: Good */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onRate('good')}
            data-testid="rating-good-btn"
            style={{
              backgroundColor: 'var(--srs-good-bg)',
              color: 'var(--srs-good)',
              border: '1.5px solid rgba(59, 130, 246, 0.4)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 700,
            }}
          >
            <span style={{ fontSize: '14px' }}>Good</span>
            <span style={{ fontSize: '11px', opacity: 0.8, fontWeight: 500 }}>3d (3)</span>
          </button>

          {/* Rating 4: Easy */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onRate('easy')}
            data-testid="rating-easy-btn"
            style={{
              backgroundColor: 'var(--srs-easy-bg)',
              color: 'var(--srs-easy)',
              border: '1.5px solid rgba(16, 185, 129, 0.4)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 700,
            }}
          >
            <span style={{ fontSize: '14px' }}>Easy</span>
            <span style={{ fontSize: '11px', opacity: 0.8, fontWeight: 500 }}>7d (4)</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onFlip}
          className="btn-primary"
          style={{ width: '100%', padding: '14px', fontSize: '16px', gap: '8px' }}
          data-testid="reveal-button"
        >
          <RotateCw size={18} />
          <span>Reveal Answer</span>
        </button>
      )}
    </div>
  );
};
