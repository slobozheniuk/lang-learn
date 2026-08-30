import React, { useState } from 'react';
import { ChunkItem } from '../types';
import { triggerHaptic } from '../utils/srs';

interface TextReviewModalProps {
  title?: string;
  rawText: string;
  chunks: ChunkItem[];
  isLoadingChunks?: boolean;
  isPreparingLesson?: boolean;
  onPrepareLesson: (selectedWords: string[]) => void;
  onClose: () => void;
}

export const TextReviewModal: React.FC<TextReviewModalProps> = ({
  title,
  rawText,
  chunks,
  isLoadingChunks = false,
  isPreparingLesson = false,
  onPrepareLesson,
  onClose,
}) => {
  // Set of indices of highlighted chunks
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  const toggleChunk = (index: number, chunk: ChunkItem) => {
    if (!chunk.is_selectable) return;
    triggerHaptic('impact');
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handlePrepare = () => {
    // Get unique text strings of selected chunks
    const selectedWords: string[] = [];
    const seen = new Set<string>();

    selectedIndices.forEach((idx) => {
      const chunk = chunks[idx];
      if (chunk && chunk.is_selectable) {
        const textVal = (chunk.lemma || chunk.text).trim();
        if (textVal && !seen.has(textVal.toLowerCase())) {
          seen.add(textVal.toLowerCase());
          selectedWords.push(chunk.text.trim());
        }
      }
    });

    if (selectedWords.length === 0) {
      // If nothing selected, prompt user or select all selectable words
      const allSelectable = chunks
        .filter((c) => c.is_selectable)
        .map((c) => c.text.trim());
      onPrepareLesson(allSelectable);
    } else {
      onPrepareLesson(selectedWords);
    }
  };

  const selectedCount = selectedIndices.size;

  return (
    <div
      id="text-review-modal"
      className="modal-backdrop text-review-modal-backdrop"
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-card text-review-modal-card">
        <div className="modal-header">
          <div className="modal-icon">📖</div>
          <div className="modal-title-wrap">
            <h3 className="modal-title">{title || 'Review Text'}</h3>
            <p className="modal-subtitle">
              Tap words or phrases you don't know to highlight them
            </p>
          </div>
          <button
            id="btn-close-review-modal"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close review"
            disabled={isPreparingLesson}
          >
            ✕
          </button>
        </div>

        {/* Formatted Text with Interactive Chunks */}
        <div className="text-review-body">
          {isLoadingChunks ? (
            <div className="text-review-loading">
              <span className="spinner">⏳</span> Chunking text with AI...
            </div>
          ) : chunks.length > 0 ? (
            <div id="text-chunks-container" className="text-chunks-container">
              {chunks.map((chunk, idx) => {
                const isSelected = selectedIndices.has(idx);
                if (!chunk.is_selectable) {
                  return (
                    <span key={idx} className="text-chunk-non-selectable">
                      {chunk.text}
                    </span>
                  );
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`text-chunk-token ${isSelected ? 'is-highlighted selected' : ''}`}
                    data-chunk-index={idx}
                    data-selected={isSelected ? 'true' : 'false'}
                    onClick={() => toggleChunk(idx, chunk)}
                    aria-pressed={isSelected}
                  >
                    {chunk.text}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-review-fallback">
              <p>{rawText}</p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="modal-actions text-review-actions">
          <button
            id="btn-prepare-lesson"
            className="btn btn-primary btn-full"
            disabled={isPreparingLesson || isLoadingChunks}
            onClick={handlePrepare}
          >
            {isPreparingLesson
              ? '⏳ Preparing Lesson...'
              : selectedCount > 0
              ? `🎯 Prepare lesson (${selectedCount} selected)`
              : '🎯 Prepare lesson'}
          </button>
          <button
            id="btn-cancel-review"
            className="btn btn-outline btn-full"
            disabled={isPreparingLesson}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
