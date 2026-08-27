import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewPage } from '../pages/ReviewPage';
import { useReviewStore } from '../stores/reviewStore';
import { useLangStore } from '../stores/langStore';
import { reviewApi } from '../api/review';

describe('ReviewPage Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useLangStore.setState({
      sourceLang: 'ru',
      targetLang: 'nl',
    });
    useReviewStore.setState({
      dueCards: [],
      currentIndex: 0,
      isFlipped: false,
      sessionResults: [],
      isSessionCompleted: false,
      isLoading: false,
      isSubmitting: false,
      error: null,
    });
  });

  it('renders empty state when there are no reviews due', async () => {
    vi.spyOn(reviewApi, 'getDueReviews').mockResolvedValue([]);

    render(
      <BrowserRouter>
        <ReviewPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('no-reviews-state')).toBeInTheDocument();
      expect(screen.getByText('All Caught Up! 🎉')).toBeInTheDocument();
    });
  });

  it('progresses through flashcards and renders SessionSummary on completion', async () => {
    const mockCards = [
      {
        word: {
          id: 10,
          language_code: 'nl',
          text: 'fiets',
          translation: 'bicycle',
          pos: 'noun',
          phonetic: 'fits',
          context_phrase: 'Ik rijd op mijn fiets.',
          audio_url: null,
          created_at: '',
          updated_at: '',
        },
        stats: null,
        is_new: true,
      },
    ];

    vi.spyOn(reviewApi, 'getDueReviews').mockResolvedValue(mockCards);
    vi.spyOn(reviewApi, 'submitReview').mockResolvedValue({
      word_id: 10,
      score: 4,
      stats: {
        id: 1,
        user_id: 1,
        word_id: 10,
        repetition_number: 1,
        interval_days: 3,
        ease_factor: 2.5,
        next_review_at: '',
        last_reviewed_at: '',
        recall_count: 1,
        fail_count: 0,
      },
      next_review_at: '2026-08-24T00:00:00Z',
    });

    render(
      <BrowserRouter>
        <ReviewPage />
      </BrowserRouter>
    );

    // Should display the first card
    await waitFor(() => {
      expect(screen.getByTestId('card-front-word')).toHaveTextContent('fiets');
    });

    // Reveal answer
    const revealBtn = screen.getByTestId('reveal-button');
    fireEvent.click(revealBtn);

    // Rate card as Good
    const goodBtn = screen.getByTestId('rating-good-btn');
    fireEvent.click(goodBtn);

    // Should transition to SessionSummary
    await waitFor(() => {
      expect(screen.getByTestId('session-summary')).toBeInTheDocument();
      expect(screen.getByText('Session Complete! 🎉')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });
});
