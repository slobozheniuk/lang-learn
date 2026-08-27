import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useLangStore } from '../stores/langStore';
import {
  Globe,
  User as UserIcon,
  LogOut,
  LogIn,
  Plus,
  Moon,
  Sun,
  ChevronDown,
} from 'lucide-react';

interface HeaderProps {
  onOpenWordAdd?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenWordAdd }) => {
  const { user, isAuthenticated, logout, openLoginModal } = useAuthStore();
  const { availablePairs, sourceLang, targetLang, setLanguagePair } = useLangStore();
  
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDarkMode(isDark);
  }, []);

  const toggleTheme = () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    setIsDarkMode(!isDarkMode);
  };

  const currentPair = availablePairs.find(
    (p) => p.source === sourceLang && p.target === targetLang
  ) || {
    source: sourceLang,
    target: targetLang,
    label: `${sourceLang.toUpperCase()} → ${targetLang.toUpperCase()}`,
  };

  return (
    <header className="header" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      backgroundColor: 'var(--bg-header)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backdropFilter: 'blur(8px)',
    }}>
      {/* Brand / Logo */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'inherit' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: 'var(--radius-sm)',
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: 'bold',
          fontSize: '18px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          ⚡
        </div>
        <span style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          LinguaFlash
        </span>
      </Link>

      {/* Center / Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Language Pair Selector Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
            style={{
              padding: '6px 10px',
              fontSize: '13px',
              fontWeight: 600,
              gap: '6px',
              borderRadius: 'var(--radius-full)',
            }}
            aria-label="Select language pair"
            data-testid="lang-selector-btn"
          >
            <Globe size={14} />
            <span>{currentPair.label}</span>
            <ChevronDown size={14} />
          </button>

          {isLangMenuOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 110 }}
                onClick={() => setIsLangMenuOpen(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '6px',
                  minWidth: '170px',
                  zIndex: 120,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                {availablePairs.map((pair) => (
                  <button
                    key={`${pair.source}-${pair.target}`}
                    type="button"
                    onClick={() => {
                      setLanguagePair(pair.source, pair.target);
                      setIsLangMenuOpen(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      fontWeight: 500,
                      textAlign: 'left',
                      backgroundColor:
                        sourceLang === pair.source && targetLang === pair.target
                          ? 'var(--border-color-subtle)'
                          : 'transparent',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                    }}
                  >
                    <span>{pair.label}</span>
                    {sourceLang === pair.source && targetLang === pair.target && (
                      <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Quick Add Word Button */}
        {onOpenWordAdd && (
          <button
            type="button"
            className="btn-icon"
            onClick={onOpenWordAdd}
            title="Add new word"
            aria-label="Add Word"
            data-testid="header-add-word-btn"
            style={{ width: '34px', height: '34px' }}
          >
            <Plus size={18} />
          </button>
        )}

        {/* Dark/Light Toggle */}
        <button
          type="button"
          className="btn-icon"
          onClick={toggleTheme}
          title="Toggle theme"
          aria-label="Toggle theme"
          style={{ width: '34px', height: '34px' }}
        >
          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Auth status / Login Button */}
        {isAuthenticated && user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
              data-testid="user-badge"
            >
              <UserIcon size={14} />
              <span>{user.username}</span>
            </div>
            <button
              type="button"
              className="btn-icon"
              onClick={logout}
              title="Log out"
              aria-label="Log Out"
              data-testid="logout-btn"
              style={{ width: '34px', height: '34px', color: 'var(--color-destructive)' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={() => openLoginModal('login')}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              borderRadius: 'var(--radius-full)',
              gap: '4px',
            }}
            data-testid="login-btn"
          >
            <LogIn size={14} />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
