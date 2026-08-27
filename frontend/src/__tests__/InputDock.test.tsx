import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InputDock } from '../components/InputDock';

describe('InputDock Component', () => {
  it('toggles between raw text textarea and YouTube url input', () => {
    const handleSubmit = vi.fn();
    render(<InputDock onSubmit={handleSubmit} />);

    // Default mode is text
    expect(screen.getByTestId('dock-textarea')).toBeInTheDocument();
    expect(screen.queryByTestId('dock-url-input')).not.toBeInTheDocument();

    // Toggle to YouTube mode
    const youtubeBtn = screen.getByTestId('mode-youtube-btn');
    fireEvent.click(youtubeBtn);

    expect(screen.queryByTestId('dock-textarea')).not.toBeInTheDocument();
    expect(screen.getByTestId('dock-url-input')).toBeInTheDocument();

    // Toggle back to text mode
    const textBtn = screen.getByTestId('mode-text-btn');
    fireEvent.click(textBtn);
    expect(screen.getByTestId('dock-textarea')).toBeInTheDocument();
  });

  it('submits text input correctly and clears the field', async () => {
    const handleSubmit = vi.fn();
    render(<InputDock onSubmit={handleSubmit} />);

    const textarea = screen.getByTestId('dock-textarea');
    fireEvent.change(textarea, { target: { value: 'Hier is een nieuwe les tekst' } });

    const submitBtn = screen.getByTestId('dock-submit-btn');
    fireEvent.click(submitBtn);

    expect(handleSubmit).toHaveBeenCalledWith('Hier is een nieuwe les tekst', 'text');
    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('submits YouTube URL correctly in youtube mode', () => {
    const handleSubmit = vi.fn();
    render(<InputDock onSubmit={handleSubmit} />);

    fireEvent.click(screen.getByTestId('mode-youtube-btn'));
    const urlInput = screen.getByTestId('dock-url-input');
    fireEvent.change(urlInput, { target: { value: 'https://youtube.com/watch?v=abcdef' } });

    fireEvent.click(screen.getByTestId('dock-submit-btn'));
    expect(handleSubmit).toHaveBeenCalledWith('https://youtube.com/watch?v=abcdef', 'youtube');
  });

  it('calls onOpenWordAdd when Add Word button is clicked in dock', () => {
    const handleOpenWordAdd = vi.fn();
    render(<InputDock onSubmit={vi.fn()} onOpenWordAdd={handleOpenWordAdd} />);

    const addWordBtn = screen.getByTestId('dock-add-word-btn');
    fireEvent.click(addWordBtn);
    expect(handleOpenWordAdd).toHaveBeenCalledTimes(1);
  });
});
