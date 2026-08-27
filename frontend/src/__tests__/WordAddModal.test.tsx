import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WordAddModal } from '../components/WordAddModal';
import { wordsApi } from '../api/words';
import { useLangStore } from '../stores/langStore';

describe('WordAddModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useLangStore.setState({
      languages: [
        { code: 'nl', name: 'Dutch', created_at: '' },
        { code: 'en', name: 'English', created_at: '' },
      ],
      targetLang: 'nl',
    });
  });

  it('renders modal when open and submits new word to API', async () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    const mockCreatedWord = {
      id: 501,
      language_code: 'nl',
      text: 'ontwikkelen',
      translation: 'to develop',
      pos: 'verb',
      lemma: 'ontwikkelen',
      phonetic: 'ɔntˈʋɪkələ(n)',
      context_phrase: 'We ontwikkelen een applicatie.',
      created_at: '2026-08-20T00:00:00Z',
      updated_at: '2026-08-20T00:00:00Z',
    };

    vi.spyOn(wordsApi, 'createWord').mockResolvedValue(mockCreatedWord);

    render(
      <WordAddModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    expect(screen.getByTestId('word-add-modal')).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByTestId('word-text-input'), {
      target: { value: 'ontwikkelen' },
    });
    fireEvent.change(screen.getByTestId('word-translation-input'), {
      target: { value: 'to develop' },
    });
    fireEvent.change(screen.getByTestId('word-pos-select'), {
      target: { value: 'verb' },
    });
    fireEvent.change(screen.getByTestId('word-context-input'), {
      target: { value: 'We ontwikkelen een applicatie.' },
    });

    // Submit
    fireEvent.click(screen.getByTestId('word-submit-btn'));

    await waitFor(() => {
      expect(wordsApi.createWord).toHaveBeenCalledWith(
        expect.objectContaining({
          language_code: 'nl',
          text: 'ontwikkelen',
          translation: 'to develop',
          pos: 'verb',
          context_phrase: 'We ontwikkelen een applicatie.',
        })
      );
      expect(handleSuccess).toHaveBeenCalledWith(mockCreatedWord);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  it('does not render when isOpen is false', () => {
    render(<WordAddModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('word-add-modal')).not.toBeInTheDocument();
  });
});
