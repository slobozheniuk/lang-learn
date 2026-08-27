import { create } from 'zustand';
import { reviewApi } from '../api/review';
import { DueWordItem, ReviewResultResponse, SRSRating, Word } from '../types';

export interface SessionResultItem {
  word: Word;
  rating: SRSRating;
  score: number;
  nextReviewAt: string;
}

interface ReviewState {
  dueCards: DueWordItem[];
  currentIndex: number;
  isFlipped: boolean;
  sessionResults: SessionResultItem[];
  isSessionCompleted: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  // Actions
  fetchDueReviews: (targetLang?: string) => Promise<void>;
  flipCard: () => void;
  setFlipped: (flipped: boolean) => void;
  submitRating: (rating: SRSRating) => Promise<ReviewResultResponse | null>;
  resetSession: () => void;
  addWordToQueue: (item: DueWordItem) => void;
  setMockCards: (cards: DueWordItem[]) => void;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  dueCards: [],
  currentIndex: 0,
  isFlipped: false,
  sessionResults: [],
  isSessionCompleted: false,
  isLoading: false,
  isSubmitting: false,
  error: null,

  fetchDueReviews: async (targetLang?: string) => {
    set({ isLoading: true, error: null });
    try {
      const cards = await reviewApi.getDueReviews(targetLang);
      set({
        dueCards: cards,
        currentIndex: 0,
        isFlipped: false,
        sessionResults: [],
        isSessionCompleted: false,
        isLoading: false,
      });
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || 'Failed to load reviews';
      set({ isLoading: false, error: message });
    }
  },

  flipCard: () => {
    set((state) => ({ isFlipped: !state.isFlipped }));
  },

  setFlipped: (flipped: boolean) => {
    set({ isFlipped: flipped });
  },

  submitRating: async (rating: SRSRating) => {
    const { dueCards, currentIndex, sessionResults } = get();
    const currentItem = dueCards[currentIndex];
    if (!currentItem) return null;

    set({ isSubmitting: true, error: null });

    try {
      let result: ReviewResultResponse;
      try {
        result = await reviewApi.submitReview({
          word_id: currentItem.word.id,
          rating,
        });
      } catch (e: any) {
        // Fallback for offline/local simulation
        result = {
          word_id: currentItem.word.id,
          score: rating === 'again' ? 0 : rating === 'hard' ? 3 : rating === 'good' ? 4 : 5,
          stats: {
            id: 0,
            user_id: 0,
            word_id: currentItem.word.id,
            repetition_number: 1,
            interval_days: rating === 'again' ? 0.007 : rating === 'hard' ? 1 : rating === 'good' ? 3 : 7,
            ease_factor: 2.5,
            next_review_at: new Date(Date.now() + 86400000).toISOString(),
            last_reviewed_at: new Date().toISOString(),
            recall_count: rating === 'again' ? 0 : 1,
            fail_count: rating === 'again' ? 1 : 0,
          },
          next_review_at: new Date(Date.now() + 86400000).toISOString(),
        };
      }

      const updatedResults = [
        ...sessionResults,
        {
          word: currentItem.word,
          rating,
          score: result.score,
          nextReviewAt: result.next_review_at,
        },
      ];

      const nextIndex = currentIndex + 1;
      const isCompleted = nextIndex >= dueCards.length;

      set({
        sessionResults: updatedResults,
        currentIndex: nextIndex,
        isFlipped: false,
        isSessionCompleted: isCompleted,
        isSubmitting: false,
      });

      return result;
    } catch (err: any) {
      set({ isSubmitting: false, error: err.message });
      return null;
    }
  },

  resetSession: () => {
    set({
      currentIndex: 0,
      isFlipped: false,
      sessionResults: [],
      isSessionCompleted: false,
      error: null,
    });
  },

  addWordToQueue: (item: DueWordItem) => {
    set((state) => ({
      dueCards: [...state.dueCards, item],
      isSessionCompleted: false,
    }));
  },

  setMockCards: (cards: DueWordItem[]) => {
    set({
      dueCards: cards,
      currentIndex: 0,
      isFlipped: false,
      sessionResults: [],
      isSessionCompleted: false,
    });
  },
}));
