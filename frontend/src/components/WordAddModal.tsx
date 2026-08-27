import React, { useState } from 'react';
import { wordsApi } from '../api/words';
import { useLangStore } from '../stores/langStore';
import { useReviewStore } from '../stores/reviewStore';
import { Word, WordCreatePayload } from '../types';
import { X, Plus, Sparkles, Loader2, AlertCircle } from 'lucide-react';

interface WordAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (word: Word) => void;
}

export const WordAddModal: React.FC<WordAddModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { languages, targetLang } = useLangStore();
  const { addWordToQueue } = useReviewStore();

  const [formData, setFormData] = useState<WordCreatePayload>({
    language_code: targetLang || 'nl',
    text: '',
    translation: '',
    lemma: '',
    pos: 'noun',
    phonetic: '',
    context_phrase: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.text.trim()) {
      setError('Please enter a word or phrase.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const createdWord = await wordsApi.createWord({
        ...formData,
        text: formData.text.trim(),
        translation: formData.translation?.trim() || null,
        lemma: formData.lemma?.trim() || null,
        pos: formData.pos || null,
        phonetic: formData.phonetic?.trim() || null,
        context_phrase: formData.context_phrase?.trim() || null,
      });

      // Add to active queue as a new word item
      addWordToQueue({
        word: createdWord,
        stats: null,
        is_new: true,
      });

      onSuccess?.(createdWord);
      onClose();
      // Reset form
      setFormData({
        language_code: targetLang || 'nl',
        text: '',
        translation: '',
        lemma: '',
        pos: 'noun',
        phonetic: '',
        context_phrase: '',
      });
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to add word.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} data-testid="word-add-modal-overlay">
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        data-testid="word-add-modal"
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(36, 129, 204, 0.12)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={18} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Add New Word</h3>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            style={{ width: '32px', height: '32px' }}
            aria-label="Close"
            data-testid="modal-close-btn"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--srs-again-bg)',
              color: 'var(--srs-again)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              marginBottom: '14px',
            }}
            data-testid="word-add-error"
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Word Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '4px',
                }}
              >
                Target Language
              </label>
              <select
                name="language_code"
                value={formData.language_code}
                onChange={handleChange}
                data-testid="word-lang-select"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name} ({l.code.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '4px',
                }}
              >
                Part of Speech
              </label>
              <select
                name="pos"
                value={formData.pos || ''}
                onChange={handleChange}
                data-testid="word-pos-select"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                }}
              >
                <option value="noun">Noun</option>
                <option value="verb">Verb</option>
                <option value="adjective">Adjective</option>
                <option value="adverb">Adverb</option>
                <option value="phrase">Phrase / Idiom</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '4px',
              }}
            >
              Word / Phrase <span style={{ color: 'var(--color-destructive)' }}>*</span>
            </label>
            <input
              type="text"
              name="text"
              value={formData.text}
              onChange={handleChange}
              placeholder="e.g., gezellig, challenge, спасибо"
              required
              data-testid="word-text-input"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '4px',
              }}
            >
              Translation
            </label>
            <input
              type="text"
              name="translation"
              value={formData.translation || ''}
              onChange={handleChange}
              placeholder="e.g., cosy / pleasant / sociable"
              data-testid="word-translation-input"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '4px',
                }}
              >
                Lemma / Base Form
              </label>
              <input
                type="text"
                name="lemma"
                value={formData.lemma || ''}
                onChange={handleChange}
                placeholder="e.g. gezellig"
                data-testid="word-lemma-input"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '4px',
                }}
              >
                Phonetic IPA
              </label>
              <input
                type="text"
                name="phonetic"
                value={formData.phonetic || ''}
                onChange={handleChange}
                placeholder="e.g. ɣəˈzɛləx"
                data-testid="word-phonetic-input"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '4px',
              }}
            >
              Context Phrase / Example
            </label>
            <textarea
              name="context_phrase"
              value={formData.context_phrase || ''}
              onChange={handleChange}
              placeholder="e.g., Het was gisteravond heel gezellig bij het diner."
              rows={2}
              data-testid="word-context-input"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                resize: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              style={{ flex: 1 }}
              data-testid="word-cancel-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.text.trim()}
              className="btn-primary"
              style={{ flex: 2, gap: '6px' }}
              data-testid="word-submit-btn"
            >
              {isLoading ? (
                <Loader2 size={16} style={{ animation: 'spin-gradient-transform 1s linear infinite' }} />
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Save to Dictionary</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
