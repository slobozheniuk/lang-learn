import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FlashcardItem, Language, User } from './types';
import {
  setApiToken,
  fetchMe,
  loginUser,
  registerUser,
  fetchLanguages,
  fetchWords,
  fetchDueReviews,
  createWord,
  submitReviewRating,
} from './api';

// Telegram Web App SDK Helpers
function initTelegram() {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    try {
      (window as any).Telegram.WebApp.ready();
      (window as any).Telegram.WebApp.expand();
    } catch (e) {
      console.warn('Telegram WebApp init:', e);
    }
  }
}

function triggerHaptic(type: 'impact' | 'success' | 'error' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
    try {
      if (type === 'impact') {
        (window as any).Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      } else if (type === 'success') {
        (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      } else if (type === 'error') {
        (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('error');
      }
    } catch (e) {
      // Ignore haptic errors
    }
  }
}

// Pronunciation / Audio
function pronounceWord(text: string, langCode: string = 'en') {
  if (!text || typeof window === 'undefined') return;
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported');
    return;
  }
  try {
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const code = (langCode || 'en').toLowerCase().trim();
    if (code === 'nl') {
      utterance.lang = 'nl-NL';
    } else if (code === 'ru') {
      utterance.lang = 'ru-RU';
    } else if (code === 'en') {
      utterance.lang = 'en-US';
    } else if (code === 'de') {
      utterance.lang = 'de-DE';
    } else if (code === 'fr') {
      utterance.lang = 'fr-FR';
    } else if (code === 'es') {
      utterance.lang = 'es-ES';
    } else if (code === 'it') {
      utterance.lang = 'it-IT';
    } else {
      utterance.lang = code.includes('-') ? code : (code + '-' + code.toUpperCase());
    }
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.onerror = (e) => console.warn('Utterance error:', e);
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech synthesis error:', e);
  }
}

export function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ll_token') || null);
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('ll_user') || 'null');
    } catch {
      return null;
    }
  });

  const [languages, setLanguages] = useState<Language[]>([]);
  const [deck, setDeck] = useState<FlashcardItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regTargetLang, setRegTargetLang] = useState('en');

  const [quickInput, setQuickInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Refs for stable callbacks & listeners
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const userRef = useRef(user);
  userRef.current = user;
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const isModalOpenRef = useRef(isModalOpen);
  isModalOpenRef.current = isModalOpen;

  // Deck loading function
  const loadDeck = useCallback(async (selectWordId?: number | null, fallbackWord?: FlashcardItem | null) => {
    setIsFlipped(false);
    try {
      let cards: FlashcardItem[] = [];
      if (tokenRef.current) {
        const dueItems = await fetchDueReviews();
        cards = (dueItems || []).map((item) => ({
          ...item.word,
          stats: item.stats,
          is_new: item.is_new,
        }));
      } else {
        const words = await fetchWords(50);
        cards = words || [];
      }

      if (fallbackWord) {
        const hasFallback = cards.some((w) => w.id === fallbackWord.id);
        if (!hasFallback) {
          cards.unshift(fallbackWord);
        }
      }

      setDeck(cards);
      if (selectWordId) {
        const foundIdx = cards.findIndex((w) => w.id === selectWordId);
        setCurrentIndex(foundIdx >= 0 ? foundIdx : 0);
      } else {
        setCurrentIndex((prev) => (prev >= cards.length ? Math.max(0, cards.length - 1) : prev));
      }
    } catch (err) {
      console.error('Error loading deck:', err);
      if (fallbackWord) {
        setDeck([fallbackWord]);
        setCurrentIndex(0);
      } else {
        setDeck([]);
        setCurrentIndex(0);
      }
    }
  }, []);

  // Language loading function
  const loadLanguages = useCallback(async () => {
    try {
      const langs = await fetchLanguages();
      setLanguages(langs || []);
      if (userRef.current?.default_target_lang) {
        setRegTargetLang(userRef.current.default_target_lang);
      }
    } catch (e) {
      console.warn('Failed to load languages:', e);
    }
  }, []);

  // Check initial authentication
  const checkAuth = useCallback(async () => {
    if (!tokenRef.current) {
      return;
    }
    try {
      const u = await fetchMe();
      setUser(u);
      localStorage.setItem('ll_user', JSON.stringify(u));
    } catch {
      setApiToken(null);
      setToken(null);
      setUser(null);
      localStorage.removeItem('ll_user');
    }
  }, []);

  // SRS Rating submission
  const submitRating = useCallback(async (rating: 'again' | 'good') => {
    if (deckRef.current.length === 0) return;
    const card = deckRef.current[currentIndexRef.current];
    if (!card) return;

    if (!tokenRef.current) {
      setIsModalOpen(true);
      setAuthTab('login');
      setAuthError('Please sign in or register to record your review progress.');
      return;
    }

    try {
      if (rating === 'again') {
        triggerHaptic('error');
      } else {
        triggerHaptic('success');
      }

      await submitReviewRating(card.id, rating);

      setDeck((prevDeck) => {
        const nextDeck = [...prevDeck];
        nextDeck.splice(currentIndexRef.current, 1);
        return nextDeck;
      });
      setCurrentIndex((prevIdx) => {
        const newLen = deckRef.current.length - 1;
        if (prevIdx >= newLen) {
          return 0;
        }
        return prevIdx;
      });
      setIsFlipped(false);
    } catch (err) {
      triggerHaptic('error');
      console.error('Failed to submit review rating:', err);
    }
  }, []);

  // Expose loadDeck and submitRating globally for verification / interop
  useEffect(() => {
    (window as any).loadDeck = loadDeck;
    (window as any).submitRating = submitRating;
  }, [loadDeck, submitRating]);

  // Initial boot
  useEffect(() => {
    initTelegram();
    checkAuth().then(() => {
      loadLanguages();
      loadDeck();
    });
  }, [checkAuth, loadLanguages, loadDeck]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpenRef.current) {
          setIsModalOpen(false);
        }
        return;
      }

      const activeEl = document.activeElement;
      if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
        triggerHaptic('impact');
      } else if (e.key === '1' || e.key === 'ArrowLeft' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        submitRating('again');
      } else if (
        e.key === '2' ||
        e.key === 'ArrowRight' ||
        e.key === 'v' ||
        e.key === 'V' ||
        e.key === 'y' ||
        e.key === 'Y' ||
        e.key === 'Enter'
      ) {
        e.preventDefault();
        submitRating('good');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [submitRating]);

  // Quick word form submit
  const handleQuickWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = quickInput.trim();
    if (!raw) return;

    if (!token) {
      setIsModalOpen(true);
      setAuthTab('login');
      setAuthError('Please sign in or register to add words.');
      return;
    }

    let text = raw;
    let translation = raw;
    const match = raw.match(/^(.*?)\s*(?:[-–—=:]|->|=>)\s*(.+)$/);
    if (match && match[1].trim() && match[2].trim()) {
      text = match[1].trim();
      translation = match[2].trim();
    }

    const language_code =
      (user && user.default_target_lang) ||
      (languages && languages.length ? languages[0].code : 'en');

    setIsSending(true);
    try {
      const newWord = await createWord({
        text,
        translation,
        language_code,
      });

      triggerHaptic('success');
      setQuickInput('');

      const newCard: FlashcardItem = {
        ...newWord,
        stats: null,
        is_new: true,
      };

      setDeck((prevDeck) => {
        const filtered = prevDeck.filter((w) => w.id !== newWord.id);
        return [newCard, ...filtered];
      });
      setCurrentIndex(0);
      setIsFlipped(false);

      loadDeck(newWord.id, newCard).catch((err) =>
        console.warn('Background loadDeck failed:', err)
      );
    } catch (err) {
      triggerHaptic('error');
      console.error('Failed to add word:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Flip card
  const handleFlipCard = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFlipped((prev) => !prev);
    triggerHaptic('impact');
  };

  // Audio button click
  const handleAudioClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.blur();
    const currentCard = deck[currentIndex];
    const text = currentCard?.text || '';
    const lang = currentCard?.language_code || user?.default_target_lang || 'en';
    if (text) {
      pronounceWord(text, lang);
      triggerHaptic('impact');
    }
  };

  // Rating button click
  const handleRatingClick = (rating: 'again' | 'good', e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.blur();
    submitRating(rating);
  };

  // Login submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier || !loginPassword) {
      setAuthError('Please fill in all fields');
      return;
    }

    try {
      const res = await loginUser({
        username_or_email: loginIdentifier,
        password: loginPassword,
      });
      const tok = res.access_token;
      setApiToken(tok);
      setToken(tok);
      const u = await fetchMe();
      setUser(u);
      localStorage.setItem('ll_user', JSON.stringify(u));
      setIsModalOpen(false);
      setAuthError(null);
      triggerHaptic('success');
      loadLanguages();
      loadDeck();
    } catch (err: any) {
      setAuthError(err.message || 'Invalid username or password');
      triggerHaptic('error');
    }
  };

  // Register submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername || !regEmail || !regPassword) {
      setAuthError('Please fill in all fields');
      return;
    }

    try {
      const res = await registerUser({
        username: regUsername,
        email: regEmail,
        password: regPassword,
        default_source_lang: 'ru',
        default_target_lang: regTargetLang || 'en',
      });
      const tok = res.token.access_token;
      setApiToken(tok);
      setToken(tok);
      setUser(res.user);
      localStorage.setItem('ll_user', JSON.stringify(res.user));
      setIsModalOpen(false);
      setAuthError(null);
      triggerHaptic('success');
      loadLanguages();
      loadDeck();
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
      triggerHaptic('error');
    }
  };

  // Quick Demo Login
  const handleQuickDemoLogin = async () => {
    const demoUser = {
      username: 'demo_student',
      email: 'student@example.com',
      password: 'demopassword123',
      default_source_lang: 'ru',
      default_target_lang: 'en',
    };

    try {
      const res = await loginUser({
        username_or_email: demoUser.username,
        password: demoUser.password,
      });
      const tok = res.access_token;
      setApiToken(tok);
      setToken(tok);
      const u = await fetchMe();
      setUser(u);
      localStorage.setItem('ll_user', JSON.stringify(u));
      setIsModalOpen(false);
      setAuthError(null);
      loadLanguages();
      loadDeck();
    } catch {
      try {
        const regRes = await registerUser(demoUser);
        const tok = regRes.token.access_token;
        setApiToken(tok);
        setToken(tok);
        setUser(regRes.user);
        localStorage.setItem('ll_user', JSON.stringify(regRes.user));
        setIsModalOpen(false);
        setAuthError(null);
        loadLanguages();
        loadDeck();
      } catch (regErr: any) {
        setAuthError(regErr.message || 'Quick demo login failed');
      }
    }
  };

  // Logout
  const handleLogout = () => {
    setApiToken(null);
    setToken(null);
    setUser(null);
    localStorage.removeItem('ll_user');
    loadDeck();
  };

  const currentCard = deck.length > 0 && currentIndex < deck.length ? deck[currentIndex] : null;

  return (
    <>
      {/* App Header */}
      <header className="app-header">
        <div className="header-content">
          <a href="/" className="brand">
            <span className="brand-icon">⚡</span>
            <span>LangLearn</span>
          </a>
          <div id="auth-nav" className="auth-nav">
            {token && user ? (
              <>
                <div className="user-badge" title={'Logged in as ' + user.username}>
                  <span>👤</span>
                  <span className="user-name">{user.username}</span>
                </div>
                <button id="btn-logout" className="btn btn-outline btn-sm" onClick={handleLogout}>
                  Sign Out
                </button>
              </>
            ) : (
              <button
                id="btn-open-login"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setIsModalOpen(true);
                  setAuthTab('login');
                  setAuthError(null);
                }}
              >
                Sign In / Register
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="app-container">
        {/* 3D Flashcard Presentation */}
        <div
          id="flashcard-scene"
          className="flashcard-scene"
          style={{ display: currentCard ? 'block' : 'none' }}
        >
          <div
            id="flashcard"
            className={'flashcard' + (isFlipped ? ' is-flipped flipped' : '')}
            role="button"
            tabIndex={0}
            aria-label="Flashcard. Click to flip"
            aria-expanded={isFlipped ? 'true' : 'false'}
            onClick={handleFlipCard}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsFlipped((f) => !f);
              }
            }}
          >
            {/* Front Face */}
            <div className="card-face card-face-front">
              <div className="card-main-content">
                <div id="card-word" className="card-word">
                  {currentCard ? currentCard.text : 'word'}
                </div>
                <div id="card-phonetic" className="card-phonetic">
                  {currentCard?.phonetic
                    ? '[' + currentCard.phonetic + ']'
                    : currentCard?.pos
                    ? '(' + currentCard.pos + ')'
                    : ''}
                </div>
              </div>
              <div className="card-bottom-hint">
                <span>👆 Tap card to flip and reveal translation</span>
              </div>
            </div>

            {/* Back Face */}
            <div className="card-face card-face-back">
              <div className="card-main-content">
                <div id="card-translation" className="card-translation">
                  {currentCard ? currentCard.translation : 'translation'}
                </div>
                <div
                  id="card-context"
                  className="card-context"
                  style={{ display: currentCard?.context_phrase ? 'block' : 'none' }}
                >
                  {currentCard?.context_phrase ? '"' + currentCard.context_phrase + '"' : ''}
                </div>
              </div>
              <div className="card-bottom-hint">
                <span>Rate your recall below:</span>
              </div>
            </div>
          </div>
        </div>

        {/* SRS Action Buttons (Red ✕, Audio 🔊, Green ✓) */}
        <div
          id="srs-ratings-wrapper"
          className="srs-ratings-wrapper"
          style={{ display: currentCard ? 'flex' : 'none' }}
        >
          <div className="srs-buttons-grid">
            <button
              id="btn-srs-wrong"
              className="srs-btn srs-btn-again srs-btn-wrong"
              data-rating="again"
              title="Forgot / Incorrect"
              aria-label="Forgot or Incorrect"
              onClick={(e) => handleRatingClick('again', e)}
            >
              <span className="srs-btn-icon">✕</span>
            </button>
            <button
              id="btn-audio"
              className="srs-btn srs-btn-audio"
              title="Pronounce word"
              aria-label="Pronounce word"
              onClick={handleAudioClick}
            >
              <span className="srs-btn-icon">🔊</span>
            </button>
            <button
              id="btn-srs-correct"
              className="srs-btn srs-btn-good srs-btn-correct"
              data-rating="good"
              title="Remembered / Correct"
              aria-label="Remembered or Correct"
              onClick={(e) => handleRatingClick('good', e)}
            >
              <span className="srs-btn-icon">✓</span>
            </button>
          </div>
        </div>

        {/* Clean Empty State */}
        <div
          id="empty-state"
          className="empty-state"
          style={{ display: !currentCard ? 'flex' : 'none' }}
        >
          <div id="empty-icon" className="empty-icon">
            ✨
          </div>
          <h3 id="empty-title" className="empty-title">
            No flashcards yet
          </h3>
          <p id="empty-desc" className="empty-desc">
            Type a word in the bar below to start learning!
          </p>
        </div>
      </main>

      {/* Floating Bottom Word Input Dock */}
      <footer className="bottom-dock">
        <div className="bottom-dock-container">
          <form
            id="quick-word-form"
            className="quick-word-form"
            autoComplete="off"
            onSubmit={handleQuickWordSubmit}
          >
            <div className="input-wrapper">
              <input
                type="text"
                id="quick-word-input"
                className="quick-word-input"
                placeholder="Type a word or phrase..."
                autoComplete="off"
                aria-label="Type a word or phrase to add"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
              />
              <button
                type="submit"
                id="btn-quick-send"
                className="btn-quick-send"
                title="Add Word"
                aria-label="Add Word"
                disabled={isSending}
              >
                <svg
                  className="send-icon"
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </div>
          </form>
        </div>
      </footer>

      {/* Auth Modal */}
      <div
        id="auth-modal"
        className={'modal-backdrop' + (isModalOpen ? ' is-open open active show' : '')}
        onClick={() => setIsModalOpen(false)}
      >
        <div
          className="modal-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3 id="modal-title" className="modal-title">
              Account
            </h3>
            <button
              id="modal-close-btn"
              className="modal-close"
              aria-label="Close modal"
              onClick={() => setIsModalOpen(false)}
            >
              &times;
            </button>
          </div>
          <div className="modal-tabs">
            <button
              id="tab-login"
              className={'modal-tab' + (authTab === 'login' ? ' active' : '')}
              onClick={() => {
                setAuthTab('login');
                setAuthError(null);
              }}
            >
              Sign In
            </button>
            <button
              id="tab-register"
              className={'modal-tab' + (authTab === 'register' ? ' active' : '')}
              onClick={() => {
                setAuthTab('register');
                setAuthError(null);
              }}
            >
              Register
            </button>
          </div>
          <div className="modal-body">
            <div id="auth-alert" className={'modal-alert' + (authError ? ' show' : '')}>
              {authError || ''}
            </div>

            {/* Login Form */}
            <form
              id="login-form"
              className="word-form"
              style={{ display: authTab === 'login' ? 'flex' : 'none' }}
              onSubmit={handleLoginSubmit}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="login-identifier">
                  Username or Email
                </label>
                <input
                  type="text"
                  id="login-identifier"
                  className="input-field"
                  placeholder="username or user@example.com"
                  required
                  autoComplete="username"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="login-password">
                  Password
                </label>
                <input
                  type="password"
                  id="login-password"
                  className="input-field"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary btn-full">
                Sign In
              </button>
            </form>

            {/* Register Form */}
            <form
              id="register-form"
              className="word-form"
              style={{ display: authTab === 'register' ? 'flex' : 'none' }}
              onSubmit={handleRegisterSubmit}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="reg-username">
                  Username
                </label>
                <input
                  type="text"
                  id="reg-username"
                  className="input-field"
                  placeholder="student123"
                  minLength={3}
                  required
                  autoComplete="username"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">
                  Email
                </label>
                <input
                  type="email"
                  id="reg-email"
                  className="input-field"
                  placeholder="student@example.com"
                  required
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-password">
                  Password
                </label>
                <input
                  type="password"
                  id="reg-password"
                  className="input-field"
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                  autoComplete="new-password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-target-lang">
                  Target Learning Language
                </label>
                <select
                  id="reg-target-lang"
                  className="lang-select"
                  value={regTargetLang}
                  onChange={(e) => setRegTargetLang(e.target.value)}
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name + ' (' + lang.code.toUpperCase() + ')'}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary btn-full">
                Create Account
              </button>
            </form>

            {/* Quick Demo Button */}
            <div
              style={{
                borderTop: '1px solid var(--border-color)',
                paddingTop: '0.85rem',
                textAlign: 'center',
              }}
            >
              <button
                type="button"
                id="quick-demo-btn"
                className="btn btn-outline btn-full btn-sm"
                onClick={handleQuickDemoLogin}
              >
                ⚡ Quick Demo Login
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;