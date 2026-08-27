import React, { useRef, useEffect, useState } from 'react';
import { Word } from '../types';
import { getRecallRate, getRecallStatus } from '../utils/srs';

interface WordItemProps {
  word: Word;
  isMenuOpen: boolean;
  onToggleMenu: (wordId: number) => void;
  onDelete: (wordId: number) => void;
  onCloseMenu: () => void;
}

export const WordItem: React.FC<WordItemProps> = ({
  word,
  isMenuOpen,
  onToggleMenu,
  onDelete,
  onCloseMenu,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openUpwards, setOpenUpwards] = useState<boolean>(false);
  const recallRate = getRecallRate(word);
  const recallStatus = getRecallStatus(recallRate);
  const isPerfect = recallStatus === 'perfect';

  // Check card position to dynamically determine if menu should open upwards
  useEffect(() => {
    if (isMenuOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      // If button is in the bottom half of the viewport or space below is less than 160px
      const spaceBelow = viewportHeight - rect.bottom;
      const shouldOpenUp = spaceBelow < 160 || rect.top > viewportHeight / 2;
      setOpenUpwards(shouldOpenUp);
    }
  }, [isMenuOpen]);

  // Handle clicking outside of open menu
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseMenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('touchstart', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [isMenuOpen, onCloseMenu]);

  return (
    <div
      id={`word-card-${word.id}`}
      data-word-id={word.id}
      className={`word-card ${isPerfect ? 'word-card-perfect' : ''} ${isMenuOpen ? 'menu-active' : ''}`}
      style={isMenuOpen ? { zIndex: 100 } : undefined}
    >
      {/* Left section: Color-coded recall rate indicator badge */}
      <div
        className={`word-recall-badge badge-${recallStatus}`}
        title={`Recall rate: ${recallRate}%`}
        data-rate={recallRate}
        data-status={recallStatus}
      >
        <span className="recall-rate-value">{recallRate}%</span>
      </div>

      {/* Center section: Target word, translation, optional pos / context */}
      <div className="word-center-content">
        <div className="word-primary-row">
          <span className="word-text-bold">
            <strong>{word.text}</strong>
          </span>
          {word.pos && <span className="word-pos-tag">{word.pos}</span>}
          {word.phonetic && <span className="word-phonetic-tag">[{word.phonetic}]</span>}
        </div>
        <div className="word-translation-sub">{word.translation}</div>
        {word.context_phrase && (
          <div className="word-context-phrase">"{word.context_phrase}"</div>
        )}
      </div>

      {/* Right section: Three-dot settings/actions menu */}
      <div className={`word-actions-wrapper ${isMenuOpen ? 'is-open' : ''}`} ref={menuRef}>
        <button
          id={`btn-word-menu-${word.id}`}
          className="btn-word-dots-menu"
          aria-label={`Options for ${word.text}`}
          aria-expanded={isMenuOpen}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu(word.id);
          }}
        >
          ⋮
        </button>

        {isMenuOpen && (
          <div
            className={`word-dropdown-menu ${openUpwards ? 'word-dropdown-up open-up is-up' : 'word-dropdown-down'}`}
            role="menu"
          >
            <button
              id={`btn-delete-word-${word.id}`}
              className="word-dropdown-item dropdown-item-delete"
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(word.id);
              }}
            >
              <span className="dropdown-icon">🗑️</span>
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
