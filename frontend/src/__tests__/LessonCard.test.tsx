import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LessonCard } from '../components/LessonCard';
import { Lesson } from '../types';

describe('LessonCard Component', () => {
  const readyLesson: Lesson = {
    id: 101,
    source_lang: 'ru',
    target_lang: 'nl',
    title: 'Ordering Food in Amsterdam',
    raw_input: 'Een tafel voor twee alstublieft.',
    input_type: 'text',
    status: 'ready',
    created_at: '2026-08-20T10:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
  };

  const processingLesson: Lesson = {
    id: 102,
    source_lang: 'en',
    target_lang: 'nl',
    title: 'YouTube Travel Vlog Lesson',
    raw_input: 'https://youtube.com/watch?v=12345',
    input_type: 'youtube',
    status: 'processing',
    created_at: '2026-08-21T10:00:00Z',
    updated_at: '2026-08-21T10:00:00Z',
  };

  it('renders ready card with active action button and calls onSelect', () => {
    const handleSelect = vi.fn();
    render(<LessonCard lesson={readyLesson} onSelect={handleSelect} />);

    expect(screen.getByTestId('lesson-card-ready')).toBeInTheDocument();
    expect(screen.getByTestId('ready-badge')).toHaveTextContent('Ready');
    expect(screen.getByTestId('lesson-title')).toHaveTextContent('Ordering Food in Amsterdam');

    const actionBtn = screen.getByTestId('lesson-action-btn');
    expect(actionBtn).not.toBeDisabled();
    expect(actionBtn).toHaveTextContent('Study Lesson');

    fireEvent.click(actionBtn);
    expect(handleSelect).toHaveBeenCalledWith(readyLesson);
  });

  it('renders processing card with rainbow animated wrapper and disabled action button', () => {
    const handleSelect = vi.fn();
    render(<LessonCard lesson={processingLesson} onSelect={handleSelect} />);

    const wrapper = screen.getByTestId('lesson-card-processing');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('processing-card-wrapper');

    expect(screen.getByTestId('processing-badge')).toHaveTextContent('Processing');

    const actionBtn = screen.getByTestId('lesson-action-btn');
    expect(actionBtn).toBeDisabled();
    expect(actionBtn).toHaveTextContent('Generating...');

    fireEvent.click(actionBtn);
    expect(handleSelect).not.toHaveBeenCalled();
  });
});
