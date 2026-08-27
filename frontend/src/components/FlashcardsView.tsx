import React from 'react';
import { FlashcardItem } from '../types';

interface FlashcardsViewProps {
  currentCard: FlashcardItem | null;
  isFlipped: boolean;
  onFlipCard: (e: React.MouseEvent) => void;
  onRatingClick: (rating: 'again' | 'good', e: React.MouseEvent<HTMLButtonElement>) => void;
  onAudioClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({
  currentCard,
  isFlipped,
  onFlipCard,
  onRatingClick,
  onAudioClick,
}) => {
  return (
    <div id="flashcards-view" className="flashcards-view">
      {/* 3D Flashcard Presentation */}
      <div
        id="flashcard-scene"
        className="flashcard-scene"
        style={{ display: currentCard ? 'block' : 'none' }}
      >
        <div
          id="flashcard"
          className={'flashcard' + (isFlipped ? ' is-flipped flipped' : '')}
          role="button"
          tabIndex={0}
          aria-label="Flashcard. Click to flip"
          aria-expanded={isFlipped ? 'true' : 'false'}
          onClick={onFlipCard}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onFlipCard(e as any);
            }
          }}
        >
          {/* Front Face */}
          <div className="card-face card-face-front">
            <div className="card-main-content">
              <div id="card-word" className="card-word">
                {currentCard ? currentCard.text : 'word'}
              </div>
              <div id="card-phonetic" className="card-phonetic">
                {currentCard?.phonetic
                  ? '[' + currentCard.phonetic + ']'
                  : currentCard?.pos
                  ? '(' + currentCard.pos + ')'
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
              <div id="card-translation" className="card-translation">
                {currentCard ? currentCard.translation : 'translation'}
              </div>
              <div
                id="card-context"
                className="card-context"
                style={{ display: currentCard?.context_phrase ? 'block' : 'none' }}
              >
                {currentCard?.context_phrase ? '"' + currentCard.context_phrase + '"' : ''}
              </div>
            </div>
            <div className="card-bottom-hint">
              <span>Rate your recall below:</span>
            </div>
          </div>
        </div>
      </div>

      {/* SRS Action Buttons (Red ✕, Audio 🔊, Green ✓) */}
      <div
        id="srs-ratings-wrapper"
        className="srs-ratings-wrapper"
        style={{ display: currentCard ? 'flex' : 'none' }}
      >
        <div className="srs-buttons-grid">
          <button
            id="btn-srs-wrong"
            className="srs-btn srs-btn-again srs-btn-wrong"
            data-rating="again"
            title="Forgot / Incorrect"
            aria-label="Forgot or Incorrect"
            onClick={(e) => onRatingClick('again', e)}
          >
            <span className="srs-btn-icon">✕</span>
          </button>
          <button
            id="btn-audio"
            className="srs-btn srs-btn-audio"
            title="Pronounce word"
            aria-label="Pronounce word"
            onClick={onAudioClick}
          >
            <span className="srs-btn-icon">🔊</span>
          </button>
          <button
            id="btn-srs-correct"
            className="srs-btn srs-btn-good srs-btn-correct"
            data-rating="good"
            title="Remembered / Correct"
            aria-label="Remembered or Correct"
            onClick={(e) => onRatingClick('good', e)}
          >
            <span className="srs-btn-icon">✓</span>
          </button>
        </div>
      </div>

      {/* Clean Empty State */}
      <div
        id="empty-state"
        className="empty-state"
        style={{ display: !currentCard ? 'flex' : 'none' }}
      >
        <div id="empty-icon" className="empty-icon">
          ✨
        </div>
        <h3 id="empty-title" className="empty-title">
          No flashcards yet
        </h3>
        <p id="empty-desc" className="empty-desc">
          Type a word in the bar below to start learning!
        </p>
      </div>
    </div>
  );
};
