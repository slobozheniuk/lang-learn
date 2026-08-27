import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { SessionSummary } from '../components/SessionSummary';
import { SessionResultItem } from '../stores/reviewStore';

describe('SessionSummary Component', () => {
  const mockResults: SessionResultItem[] = [
    {
      word: {
        id: 1,
        language_code: 'nl',
        text: 'boom',
        translation: 'tree',
        created_at: '',
        updated_at: '',
      },
      rating: 'easy',
      score: 5,
      nextReviewAt: '2026-08-28T00:00:00Z',
    },
    {
      word: {
        id: 2,
        language_code: 'nl',
        text: 'huis',
        translation: 'house',
        created_at: '',
        updated_at: '',
      },
      rating: 'good',
      score: 4,
      nextReviewAt: '2026-08-24T00:00:00Z',
    },
    {
      word: {
        id: 3,
        language_code: 'nl',
        text: 'fiets',
        translation: 'bicycle',
        created_at: '',
        updated_at: '',
      },
      rating: 'again',
      score: 0,
      nextReviewAt: '2026-08-21T10:00:00Z',
    },
    {
      word: {
        id: 4,
        language_code: 'nl',
        text: 'water',
        translation: 'water',
        created_at: '',
        updated_at: '',
      },
      rating: 'hard',
      score: 3,
      nextReviewAt: '2026-08-22T00:00:00Z',
    },
  ];

  it('renders summary statistics and recall rate percentage correctly', () => {
    const handleRestart = vi.fn();
    render(
      <BrowserRouter>
        <SessionSummary results={mockResults} onRestart={handleRestart} />
      </BrowserRouter>
    );

    expect(screen.getByTestId('session-summary')).toBeInTheDocument();
    expect(screen.getByText('Session Complete! 🎉')).toBeInTheDocument();

    // 3 remembered out of 4 = 75%
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('3/4')).toBeInTheDocument();

    // Word list
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.getByText('huis')).toBeInTheDocument();
    expect(screen.getByText('fiets')).toBeInTheDocument();
    expect(screen.getAllByText('water')[0]).toBeInTheDocument();

    // Buttons
    const restartBtn = screen.getByTestId('restart-session-btn');
    fireEvent.click(restartBtn);
    expect(handleRestart).toHaveBeenCalledTimes(1);

    expect(screen.getByTestId('summary-dashboard-btn')).toBeInTheDocument();
  });
});
