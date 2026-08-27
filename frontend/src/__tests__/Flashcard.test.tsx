import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Flashcard } from '../components/Flashcard';
import { DueWordItem } from '../types';

describe('Flashcard Component', () => {
  const mockCard: DueWordItem = {
    word: {
      id: 42,
      language_code: 'nl',
      text: 'begrijpen',
      lemma: 'begrijpen',
      pos: 'verb',
      phonetic: 'bəˈɣrɛipə(n)',
      translation: 'to understand / comprehend',
      context_phrase: 'Ik begrijp deze zin heel goed.',
      audio_url: null,
      created_at: '2026-08-20T10:00:00Z',
      updated_at: '2026-08-20T10:00:00Z',
    },
    stats: {
      id: 1,
      user_id: 1,
      word_id: 42,
      repetition_number: 2,
      interval_days: 3,
      ease_factor: 2.5,
      next_review_at: '2026-08-21T10:00:00Z',
      last_reviewed_at: '2026-08-18T10:00:00Z',
      recall_count: 2,
      fail_count: 0,
    },
    is_new: false,
  };

  it('renders front of card with target word, phonetic, pos, and reveals translation on flip', () => {
    const handleFlip = vi.fn();
    const handleRate = vi.fn();

    const { rerender } = render(
      <Flashcard
        card={mockCard}
        isFlipped={false}
        onFlip={handleFlip}
        onRate={handleRate}
      />
    );

    // Front should show word and phonetic
    expect(screen.getByTestId('card-front-word')).toHaveTextContent('begrijpen');
    expect(screen.getByText('/bəˈɣrɛipə(n)/')).toBeInTheDocument();
    expect(screen.getByText('verb')).toBeInTheDocument();
    expect(screen.getByTestId('reveal-button')).toBeInTheDocument();
    expect(screen.queryByTestId('srs-rating-buttons')).not.toBeInTheDocument();

    // Click to flip
    fireEvent.click(screen.getByTestId('flashcard-scene'));
    expect(handleFlip).toHaveBeenCalledTimes(1);

    // Rerender as flipped
    rerender(
      <Flashcard
        card={mockCard}
        isFlipped={true}
        onFlip={handleFlip}
        onRate={handleRate}
      />
    );

    expect(screen.getByTestId('flashcard-element')).toHaveClass('is-flipped');
    expect(screen.getByTestId('card-back-translation')).toHaveTextContent(
      'to understand / comprehend'
    );
    expect(screen.getByTestId('card-back-context')).toHaveTextContent(
      'Ik begrijp deze zin heel goed.'
    );

    // 4 SRS rating buttons should now be visible
    expect(screen.getByTestId('srs-rating-buttons')).toBeInTheDocument();
    expect(screen.getByTestId('rating-again-btn')).toBeInTheDocument();
    expect(screen.getByTestId('rating-hard-btn')).toBeInTheDocument();
    expect(screen.getByTestId('rating-good-btn')).toBeInTheDocument();
    expect(screen.getByTestId('rating-easy-btn')).toBeInTheDocument();
  });

  it('triggers rating callbacks when SRS buttons are clicked', () => {
    const handleFlip = vi.fn();
    const handleRate = vi.fn();

    render(
      <Flashcard
        card={mockCard}
        isFlipped={true}
        onFlip={handleFlip}
        onRate={handleRate}
      />
    );

    fireEvent.click(screen.getByTestId('rating-again-btn'));
    expect(handleRate).toHaveBeenCalledWith('again');

    fireEvent.click(screen.getByTestId('rating-hard-btn'));
    expect(handleRate).toHaveBeenCalledWith('hard');

    fireEvent.click(screen.getByTestId('rating-good-btn'));
    expect(handleRate).toHaveBeenCalledWith('good');

    fireEvent.click(screen.getByTestId('rating-easy-btn'));
    expect(handleRate).toHaveBeenCalledWith('easy');
  });

  it('supports keyboard shortcuts for flip and SRS ratings', () => {
    const handleFlip = vi.fn();
    const handleRate = vi.fn();

    const { rerender } = render(
      <Flashcard
        card={mockCard}
        isFlipped={false}
        onFlip={handleFlip}
        onRate={handleRate}
      />
    );

    // Space to flip
    fireEvent.keyDown(window, { code: 'Space' });
    expect(handleFlip).toHaveBeenCalledTimes(1);

    // Rerender as flipped
    rerender(
      <Flashcard
        card={mockCard}
        isFlipped={true}
        onFlip={handleFlip}
        onRate={handleRate}
      />
    );

    // Press '1' for Again
    fireEvent.keyDown(window, { key: '1' });
    expect(handleRate).toHaveBeenCalledWith('again');

    // Press '3' for Good
    fireEvent.keyDown(window, { key: '3' });
    expect(handleRate).toHaveBeenCalledWith('good');
  });
});
