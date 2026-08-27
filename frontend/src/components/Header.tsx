import React from 'react';
import { PageView, User } from '../types';

interface HeaderProps {
  user: User | null;
  token: string | null;
  onToggleMenu: () => void;
  onNavigate: (page: PageView) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  token,
  onToggleMenu,
  onNavigate,
  onOpenAuth,
  onLogout,
}) => {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <button
            id="burger-menu-btn"
            className="burger-menu-btn"
            aria-label="Toggle navigation menu"
            title="Menu"
            onClick={onToggleMenu}
          >
            ☰
          </button>
          <a
            href="/"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('flashcards');
            }}
          >
            <span className="brand-icon">⚡</span>
            <span className="brand-name">LangLearn</span>
          </a>
        </div>

        <div id="auth-nav" className="auth-nav">
          {token && user ? (
            <>
              <div className="user-badge" title={`Logged in as ${user.username}`}>
                <span>👤</span>
                <span className="user-name">{user.username}</span>
              </div>
              <button id="btn-logout" className="btn btn-outline btn-sm" onClick={onLogout}>
                Sign Out
              </button>
            </>
          ) : (
            <button id="btn-open-login" className="btn btn-primary btn-sm" onClick={onOpenAuth}>
              Sign In / Register
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
