import React from 'react';
import { Language, PageView, User } from '../types';
import { ProfileSwitcher } from './ProfileSwitcher';

interface HeaderProps {
  user: User | null;
  token: string | null;
  languages: Language[];
  onToggleMenu: () => void;
  onNavigate: (page: PageView) => void;
  onProfileSwitch: () => void;
  onOpenAuth?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  token,
  languages,
  onToggleMenu,
  onNavigate,
  onProfileSwitch,
}) => {
  const isAuthenticated = Boolean(token && user);

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          {isAuthenticated && (
            <button
              id="burger-menu-btn"
              className="burger-menu-btn"
              aria-label="Toggle navigation menu"
              title="Menu"
              onClick={onToggleMenu}
            >
              ☰
            </button>
          )}
          <a
            href="/"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              if (isAuthenticated) {
                onNavigate('lessons');
              }
            }}
          >
            <span className="brand-icon">⚡</span>
            <span className="brand-name">LangLearn</span>
          </a>
        </div>

        {isAuthenticated && user && (
          <div id="auth-nav" className="auth-nav">
            <ProfileSwitcher languages={languages} onProfileSwitch={onProfileSwitch} />
            <button
              id="btn-settings"
              className="btn-settings-icon"
              aria-label="Settings"
              title="Settings"
              onClick={() => onNavigate('settings')}
            >
              <svg
                className="gear-icon"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
