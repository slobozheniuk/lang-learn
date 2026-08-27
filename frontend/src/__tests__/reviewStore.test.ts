import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReviewStore } from '../stores/reviewStore';
import { reviewApi } from '../api/review';
import { DueWordItem } from '../types';

describe('useReviewStore', () => {
  const sampleCards: DueWordItem[] = [
    {
      word: {
        id: 1,
        language_code: 'nl',
        text: 'dankjewel',
        translation: 'thank you',
        created_at: '',
        updated_at: '',
      },
      stats: null,
      is_new: true,
    },
    {
      word: {
        id: 2,
        language_code: 'nl',
        text: 'alsjeblieft',
        translation: 'please',
        created_at: '',
        updated_at: '',
      },
      stats: null,
      is_new: true,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
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

  it('fetches due reviews and populates state', async () => {
    vi.spyOn(reviewApi, 'getDueReviews').mockResolvedValue(sampleCards);

    await useReviewStore.getState().fetchDueReviews('nl');

    const state = useReviewStore.getState();
    expect(state.dueCards).toHaveLength(2);
    expect(state.currentIndex).toBe(0);
    expect(state.isSessionCompleted).toBe(false);
  });

  it('handles card flipping and rating progression through entire session', async () => {
    useReviewStore.getState().setMockCards(sampleCards);

    // Initial state
    expect(useReviewStore.getState().isFlipped).toBe(false);
    expect(useReviewStore.getState().currentIndex).toBe(0);

    // Flip card 1
    useReviewStore.getState().flipCard();
    expect(useReviewStore.getState().isFlipped).toBe(true);

    // Submit rating for Card 1 ('good')
    vi.spyOn(reviewApi, 'submitReview').mockResolvedValue({
      word_id: 1,
      score: 4,
      stats: {
        id: 1,
        user_id: 1,
        word_id: 1,
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

    await useReviewStore.getState().submitRating('good');

    // Should advance to Card 2, card flipped state reset to false
    expect(useReviewStore.getState().currentIndex).toBe(1);
    expect(useReviewStore.getState().isFlipped).toBe(false);
    expect(useReviewStore.getState().sessionResults).toHaveLength(1);
    expect(useReviewStore.getState().isSessionCompleted).toBe(false);

    // Rate Card 2 ('easy')
    vi.spyOn(reviewApi, 'submitReview').mockResolvedValue({
      word_id: 2,
      score: 5,
      stats: {
        id: 2,
        user_id: 1,
        word_id: 2,
        repetition_number: 1,
        interval_days: 7,
        ease_factor: 2.6,
        next_review_at: '',
        last_reviewed_at: '',
        recall_count: 1,
        fail_count: 0,
      },
      next_review_at: '2026-08-28T00:00:00Z',
    });

    await useReviewStore.getState().submitRating('easy');

    // Should complete the session
    expect(useReviewStore.getState().currentIndex).toBe(2);
    expect(useReviewStore.getState().isSessionCompleted).toBe(true);
    expect(useReviewStore.getState().sessionResults).toHaveLength(2);
  });
});
