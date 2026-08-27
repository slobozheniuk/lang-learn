import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardPage } from '../pages/DashboardPage';
import { useReviewStore } from '../stores/reviewStore';
import { useLangStore } from '../stores/langStore';
import { reviewApi } from '../api/review';

describe('DashboardPage Integration', () => {
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
    });
  });

  it('renders dashboard hero banner, lessons feed, and bottom input dock', async () => {
    vi.spyOn(reviewApi, 'getDueReviews').mockResolvedValue([
      {
        word: {
          id: 1,
          language_code: 'nl',
          text: 'kat',
          translation: 'cat',
          created_at: '',
          updated_at: '',
        },
        stats: null,
        is_new: true,
      },
    ]);

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    // Hero banner with due count
    await waitFor(() => {
      expect(screen.getByTestId('srs-due-banner')).toBeInTheDocument();
      expect(screen.getByTestId('start-review-btn')).toBeInTheDocument();
    });

    // Lessons feed
    expect(screen.getByTestId('lessons-list')).toBeInTheDocument();

    // Input dock
    expect(screen.getByTestId('input-dock')).toBeInTheDocument();
  });

  it('adds a new lesson in processing state when submitted from dock', async () => {
    vi.spyOn(reviewApi, 'getDueReviews').mockResolvedValue([]);

    render(
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    );

    const textarea = screen.getByTestId('dock-textarea');
    fireEvent.change(textarea, { target: { value: 'New Spanish dialogue' } });

    const submitBtn = screen.getByTestId('dock-submit-btn');
    fireEvent.click(submitBtn);

    // A new card should appear with processing state
    expect(screen.getAllByText('New Spanish dialogue').length).toBeGreaterThanOrEqual(1);
    const processingBadges = screen.getAllByTestId('processing-badge');
    expect(processingBadges.length).toBeGreaterThanOrEqual(1);
  });
});
