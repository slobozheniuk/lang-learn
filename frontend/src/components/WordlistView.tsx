import React, { useState, useMemo } from 'react';
import { Word } from '../types';
import { WordItem } from './WordItem';
import { getRecallRate } from '../utils/srs';

interface WordlistViewProps {
  words: Word[];
  isLoading: boolean;
  onDeleteWord: (wordId: number) => Promise<void>;
  onRefresh: () => void;
}

const ITEMS_PER_PAGE = 20;

export const WordlistView: React.FC<WordlistViewProps> = ({
  words,
  isLoading,
  onDeleteWord,
  onRefresh,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [openMenuWordId, setOpenMenuWordId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Default sorting: from least known words (lowest recall rate percentage) to most known (highest)
  const sortedWords = useMemo(() => {
    let filtered = words;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = words.filter(
        (w) =>
          w.text.toLowerCase().includes(q) ||
          (w.translation && w.translation.toLowerCase().includes(q)) ||
          (w.lemma && w.lemma.toLowerCase().includes(q))
      );
    }

    return [...filtered].sort((a, b) => {
      const rateA = getRecallRate(a);
      const rateB = getRecallRate(b);
      if (rateA !== rateB) {
        return rateA - rateB; // Ascending: lowest recall rate first
      }
      // Tie-breaker: word ID (or alphabetical text)
      return a.id - b.id;
    });
  }, [words, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(sortedWords.length / ITEMS_PER_PAGE));
  const effectivePage = Math.min(currentPage, totalPages);

  const paginatedWords = useMemo(() => {
    const startIndex = (effectivePage - 1) * ITEMS_PER_PAGE;
    return sortedWords.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedWords, effectivePage]);

  const handleToggleMenu = (wordId: number) => {
    setOpenMenuWordId((prev) => (prev === wordId ? null : wordId));
  };

  const handleDelete = async (wordId: number) => {
    setOpenMenuWordId(null);
    await onDeleteWord(wordId);
  };

  const handlePrevPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <div id="wordlist-view" className="wordlist-view wordlist-container">
      {/* Header bar with count and search */}
      <div className="wordlist-header">
        <div className="wordlist-title-row">
          <h2 className="wordlist-heading">Wordlist</h2>
          <span className="wordlist-badge-count">{words.length} words</span>
          <button
            id="btn-refresh-wordlist"
            className="btn-refresh-icon"
            aria-label="Refresh words"
            title="Refresh list"
            onClick={onRefresh}
            disabled={isLoading}
          >
            ↻
          </button>
        </div>

        {words.length > 5 && (
          <div className="wordlist-search-wrapper">
            <input
              type="text"
              id="wordlist-search-input"
              className="wordlist-search-input"
              placeholder="Search in dictionary..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </div>

      {/* Word Cards List */}
      {paginatedWords.length > 0 ? (
        <div id="wordlist-grid" className="wordlist-grid word-list">
          {paginatedWords.map((word) => (
            <WordItem
              key={word.id}
              word={word}
              isMenuOpen={openMenuWordId === word.id}
              onToggleMenu={handleToggleMenu}
              onDelete={handleDelete}
              onCloseMenu={() => setOpenMenuWordId(null)}
            />
          ))}
        </div>
      ) : (
        <div id="wordlist-empty" className="empty-state wordlist-empty">
          <div className="empty-icon">📚</div>
          <h3 className="empty-title">
            {searchQuery ? 'No matching words found' : 'No words in your list yet'}
          </h3>
          <p className="empty-desc">
            {searchQuery
              ? 'Try a different search query.'
              : 'Add words using the input bar below or start practicing!'}
          </p>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button
            id="btn-prev-page"
            className="btn btn-outline btn-sm btn-page-nav"
            onClick={handlePrevPage}
            disabled={effectivePage <= 1}
            aria-label="Previous page"
          >
            ‹ Prev
          </button>
          <span id="pagination-info" className="pagination-info">
            Page {effectivePage} of {totalPages}
          </span>
          <button
            id="btn-next-page"
            className="btn btn-outline btn-sm btn-page-nav"
            onClick={handleNextPage}
            disabled={effectivePage >= totalPages}
            aria-label="Next page"
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  );
};
