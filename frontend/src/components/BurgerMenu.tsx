import React, { useEffect } from 'react';
import { PageView } from '../types';

interface BurgerMenuProps {
  isOpen: boolean;
  activePage: PageView;
  onClose: () => void;
  onNavigate: (page: PageView) => void;
}

export const BurgerMenu: React.FC<BurgerMenuProps> = ({
  isOpen,
  activePage,
  onClose,
  onNavigate,
}) => {
  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Drawer Backdrop Overlay */}
      <div
        id="menu-backdrop"
        className={`drawer-backdrop ${isOpen ? 'is-open open active show' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      {/* Slide-out Menu Drawer */}
      <div
        id="burger-menu-drawer"
        className={`drawer-menu ${isOpen ? 'is-open open active' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
      >
        <div className="drawer-header">
          <div className="drawer-brand">
            <span className="drawer-brand-icon">⚡</span>
            <span className="drawer-brand-title">Menu</span>
          </div>
          <button
            id="drawer-close-btn"
            className="drawer-close-btn"
            aria-label="Close menu"
            title="Close menu"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <nav className="drawer-nav">
          <button
            id="nav-link-flashcards"
            className={`drawer-nav-item ${activePage === 'flashcards' ? 'active' : ''}`}
            onClick={() => {
              onNavigate('flashcards');
              onClose();
            }}
          >
            <span className="drawer-nav-icon">🎴</span>
            <span className="drawer-nav-label">Flashcards</span>
            {activePage === 'flashcards' && <span className="active-dot" />}
          </button>

          <button
            id="nav-link-wordlist"
            className={`drawer-nav-item ${activePage === 'wordlist' ? 'active' : ''}`}
            onClick={() => {
              onNavigate('wordlist');
              onClose();
            }}
          >
            <span className="drawer-nav-icon">📖</span>
            <span className="drawer-nav-label">Wordlist</span>
            {activePage === 'wordlist' && <span className="active-dot" />}
          </button>
        </nav>
      </div>
    </>
  );
};
