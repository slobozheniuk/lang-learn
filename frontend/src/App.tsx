import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FlashcardItem, Language, Lesson, PageView, User, Word } from './types';
import {
  setApiToken,
  fetchMe,
  loginUser,
  registerUser,
  fetchLanguages,
  fetchWords,
  fetchDueReviews,
  createWord,
  deleteWord,
  submitReviewRating,
} from './api';
import {
  initTelegram,
  triggerHaptic,
  pronounceWord,
} from './utils/srs';
import { Header } from './components/Header';
import { BurgerMenu } from './components/BurgerMenu';
import { LessonsView } from './components/LessonsView';
import { LessonDetailView } from './components/LessonDetailView';
import { FlashcardsView } from './components/FlashcardsView';
import { WordlistView } from './components/WordlistView';
import { BottomDock } from './components/BottomDock';
import { AuthView } from './components/AuthView';

export function App() {
  // Navigation & View State
  const [activePage, setActivePage] = useState<PageView>('lessons');
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  // Authentication State
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ll_token') || null);
  const [user, setUser] = useState<User | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('ll_user') || 'null');
    } catch {
      return null;
    }
  });

  // Data State
  const [languages, setLanguages] = useState<Language[]>([]);
  const [deck, setDeck] = useState<FlashcardItem[]>([]);
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [isWordsLoading, setIsWordsLoading] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  // Auth Form State
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

  const isAuthenticated = Boolean(token && user);

  // Stable refs for event listeners & callbacks
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const userRef = useRef(user);
  userRef.current = user;
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const activePageRef = useRef(activePage);
  activePageRef.current = activePage;
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  // Load Wordlist
  const loadWordlist = useCallback(async () => {
    if (!tokenRef.current) return;
    setIsWordsLoading(true);
    try {
      const words = await fetchWords(100);
      setAllWords(words || []);
    } catch (e) {
      console.warn('Failed to load wordlist:', e);
      setAllWords([]);
    } finally {
      setIsWordsLoading(false);
    }
  }, []);

  // Deck loading function
  const loadDeck = useCallback(
    async (selectWordId?: number | null, fallbackWord?: FlashcardItem | null) => {
      setIsFlipped(false);
      if (!tokenRef.current) {
        setDeck([]);
        setCurrentIndex(0);
        return;
      }
      try {
        const dueItems = await fetchDueReviews();
        let cards: FlashcardItem[] = (dueItems || []).map((item) => ({
          ...item.word,
          stats: item.stats,
          user_stats: item.stats,
          is_new: item.is_new,
        }));

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
    },
    []
  );

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
      setUser(null);
      setToken(null);
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

  // Delete word from Wordlist
  const handleDeleteWord = useCallback(
    async (wordId: number) => {
      try {
        triggerHaptic('impact');
        await deleteWord(wordId);
        triggerHaptic('success');
        // Remove from current wordlist state immediately
        setAllWords((prev) => prev.filter((w) => w.id !== wordId));
        // Also remove from deck if present
        setDeck((prev) => prev.filter((w) => w.id !== wordId));
        // Refresh wordlist in background to ensure sync
        loadWordlist();
      } catch (err) {
        triggerHaptic('error');
        console.error('Failed to delete word:', err);
      }
    },
    [loadWordlist]
  );

  // SRS Rating submission
  const submitRating = useCallback(
    async (rating: 'again' | 'good') => {
      if (deckRef.current.length === 0) return;
      const card = deckRef.current[currentIndexRef.current];
      if (!card) return;

      if (!tokenRef.current) {
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
        // Refresh words in background to update stats
        loadWordlist();
      } catch (err) {
        triggerHaptic('error');
        console.error('Failed to submit review rating:', err);
      }
    },
    [loadWordlist]
  );

  // Restart Deck handler
  const handleRestartDeck = useCallback(async () => {
    triggerHaptic('impact');
    setIsFlipped(false);
    try {
      const words = (await fetchWords(100)) || [];
      setAllWords(words);
      if (words.length > 0) {
        const cards: FlashcardItem[] = words.map((w) => ({
          ...w,
          stats: w.user_stats || null,
          user_stats: w.user_stats || null,
          is_new: false,
        }));
        setDeck(cards);
        setCurrentIndex(0);
      } else {
        await loadDeck();
      }
    } catch (err) {
      console.warn('Failed to restart deck:', err);
    }
  }, [loadDeck]);

  // Navigation handler that clears any open lesson detail
  const handleNavigate = useCallback((page: PageView) => {
    setActiveLesson(null);
    setActivePage(page);
  }, []);

  // Expose methods globally for testing / verification
  useEffect(() => {
    (window as any).loadDeck = loadDeck;
    (window as any).loadWordlist = loadWordlist;
    (window as any).submitRating = submitRating;
    (window as any).restartDeck = handleRestartDeck;
    (window as any).setActiveLesson = setActiveLesson;
    (window as any).setActivePage = setActivePage;
  }, [loadDeck, loadWordlist, submitRating, handleRestartDeck]);

  // Initial boot
  useEffect(() => {
    initTelegram();
    loadLanguages();
    checkAuth().then(() => {
      if (tokenRef.current) {
        loadDeck();
        loadWordlist();
      }
    });
  }, [checkAuth, loadLanguages, loadDeck, loadWordlist]);

  // Reload wordlist when navigating to Wordlist or Lessons page
  useEffect(() => {
    if (isAuthenticated && (activePage === 'wordlist' || activePage === 'lessons')) {
      loadWordlist();
    }
  }, [isAuthenticated, activePage, loadWordlist]);

  // Global Keyboard Shortcuts (only when authenticated)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isAuthenticatedRef.current) return;

      const activeEl = document.activeElement;
      if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)) {
        return;
      }

      if (activePageRef.current === 'flashcards') {
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [submitRating]);

  // Quick word form submit
  const handleQuickWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = quickInput.trim();
    if (!raw || !token) return;

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
        user_stats: null,
        is_new: true,
      };

      setDeck((prevDeck) => {
        const filtered = prevDeck.filter((w) => w.id !== newWord.id);
        return [newCard, ...filtered];
      });
      setCurrentIndex(0);
      setIsFlipped(false);

      // Add to wordlist state
      setAllWords((prev) => [newWord, ...prev.filter((w) => w.id !== newWord.id)]);

      loadDeck(newWord.id, newCard).catch((err) =>
        console.warn('Background loadDeck failed:', err)
      );
      loadWordlist().catch((err) =>
        console.warn('Background loadWordlist failed:', err)
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
      setAuthError(null);
      setActivePage('lessons');
      setActiveLesson(null);
      triggerHaptic('success');
      loadLanguages();
      loadDeck();
      loadWordlist();
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
      setAuthError(null);
      setActivePage('lessons');
      setActiveLesson(null);
      triggerHaptic('success');
      loadLanguages();
      loadDeck();
      loadWordlist();
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
      setAuthError(null);
      setActivePage('lessons');
      setActiveLesson(null);
      loadLanguages();
      loadDeck();
      loadWordlist();
    } catch {
      try {
        const regRes = await registerUser(demoUser);
        const tok = regRes.token.access_token;
        setApiToken(tok);
        setToken(tok);
        setUser(regRes.user);
        localStorage.setItem('ll_user', JSON.stringify(regRes.user));
        setAuthError(null);
        setActivePage('lessons');
        setActiveLesson(null);
        loadLanguages();
        loadDeck();
        loadWordlist();
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
    setDeck([]);
    setAllWords([]);
    setActivePage('lessons');
    setActiveLesson(null);
    setAuthTab('login');
    setAuthError(null);
  };

  const currentCard = deck.length > 0 && currentIndex < deck.length ? deck[currentIndex] : null;

  return (
    <div className="app-shell">
      {/* App Header */}
      <Header
        user={user}
        token={token}
        onToggleMenu={() => setIsMenuOpen((prev) => !prev)}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      {!isAuthenticated ? (
        <main className="app-container auth-page-container">
          <AuthView
            authTab={authTab}
            authError={authError}
            languages={languages}
            loginIdentifier={loginIdentifier}
            loginPassword={loginPassword}
            regUsername={regUsername}
            regEmail={regEmail}
            regPassword={regPassword}
            regTargetLang={regTargetLang}
            onTabChange={(tab) => {
              setAuthTab(tab);
              setAuthError(null);
            }}
            onLoginIdentifierChange={setLoginIdentifier}
            onLoginPasswordChange={setLoginPassword}
            onRegUsernameChange={setRegUsername}
            onRegEmailChange={setRegEmail}
            onRegPasswordChange={setRegPassword}
            onRegTargetLangChange={setRegTargetLang}
            onLoginSubmit={handleLoginSubmit}
            onRegisterSubmit={handleRegisterSubmit}
            onQuickDemoLogin={handleQuickDemoLogin}
          />
        </main>
      ) : (
        <>
          <main className="app-container">
            {activePage === 'lessons' ? (
              activeLesson ? (
                <LessonDetailView
                  lesson={activeLesson}
                  onClose={() => setActiveLesson(null)}
                />
              ) : (
                <LessonsView
                  words={allWords}
                  isLoading={isWordsLoading}
                  onSelectLesson={(lesson) => setActiveLesson(lesson)}
                  onRefresh={loadWordlist}
                />
              )
            ) : activePage === 'flashcards' ? (
              <FlashcardsView
                currentCard={currentCard}
                isFlipped={isFlipped}
                hasWords={allWords.length > 0}
                onFlipCard={handleFlipCard}
                onRatingClick={handleRatingClick}
                onAudioClick={handleAudioClick}
                onRestartDeck={handleRestartDeck}
              />
            ) : (
              <WordlistView
                words={allWords}
                isLoading={isWordsLoading}
                onDeleteWord={handleDeleteWord}
                onRefresh={loadWordlist}
              />
            )}
          </main>

          {/* Pinned Bottom Word Input Dock - Hidden on active lesson view */}
          {!activeLesson && (
            <BottomDock
              quickInput={quickInput}
              isSending={isSending}
              onInputChange={setQuickInput}
              onSubmit={handleQuickWordSubmit}
            />
          )}

          {/* Cheeseburger Navigation Drawer Menu */}
          <BurgerMenu
            isOpen={isMenuOpen}
            activePage={activePage}
            onClose={() => setIsMenuOpen(false)}
            onNavigate={handleNavigate}
          />
        </>
      )}
    </div>
  );
}

export default App;