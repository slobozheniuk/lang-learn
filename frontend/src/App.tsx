import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FlashcardItem, Language, LearningProfile, Lesson, PageView, User, Word } from './types';
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
  deleteLesson,
  submitReviewRating,
  submitText,
  fetchLessons,
  generateQuizLesson,
  fetchProfiles,
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
import { SettingsView } from './components/SettingsView';

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

  // Learning Profile State
  const [profiles, setProfiles] = useState<LearningProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<LearningProfile | null>(null);

  // Data State
  const [languages, setLanguages] = useState<Language[]>([]);
  const [deck, setDeck] = useState<FlashcardItem[]>([]);
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [backendLessons, setBackendLessons] = useState<Lesson[]>([]);
  const [isWordsLoading, setIsWordsLoading] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  // Auth Form State
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);

  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regNativeLang, setRegNativeLang] = useState('ru');
  const [regTargetLang, setRegTargetLang] = useState('en');

  const [quickInput, setQuickInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [multiSentencePrompt, setMultiSentencePrompt] = useState<{
    text: string;
    words: Word[];
  } | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState<boolean>(false);

  const isAuthenticated = Boolean(token && user);

  // Stable refs for event listeners & callbacks
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const userRef = useRef(user);
  userRef.current = user;
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const activeProfileRef = useRef(activeProfile);
  activeProfileRef.current = activeProfile;
  const deckRef = useRef(deck);
  deckRef.current = deck;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const activePageRef = useRef(activePage);
  activePageRef.current = activePage;
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  // Load Profiles
  const loadProfiles = useCallback(async () => {
    if (!tokenRef.current) {
      setProfiles([]);
      setActiveProfile(null);
      return null;
    }
    try {
      const data = await fetchProfiles();
      setProfiles(data || []);
      const active = (data || []).find((p) => p.is_active) || (data || [])[0] || null;
      setActiveProfile(active);
      return active;
    } catch (e) {
      console.warn('Failed to load profiles:', e);
      setProfiles([]);
      setActiveProfile(null);
      return null;
    }
  }, []);

  // Load Wordlist
  const loadWordlist = useCallback(async () => {
    if (!tokenRef.current) return;
    setIsWordsLoading(true);
    try {
      const targetLang = activeProfileRef.current?.target_language;
      const words = await fetchWords(100, 0, targetLang);
      setAllWords(words || []);
    } catch (e) {
      console.warn('Failed to load wordlist:', e);
      setAllWords([]);
    } finally {
      setIsWordsLoading(false);
    }
  }, []);

  // Load Lessons
  const loadLessons = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const srcLang = activeProfileRef.current?.source_language;
      const tgtLang = activeProfileRef.current?.target_language;
      const lessons = await fetchLessons(srcLang, tgtLang);
      setBackendLessons(lessons || []);
    } catch (e) {
      console.warn('Failed to load lessons:', e);
      setBackendLessons([]);
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
        const targetLang = activeProfileRef.current?.target_language;
        const dueItems = await fetchDueReviews(targetLang);
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
      if (userRef.current?.native_language || userRef.current?.default_source_lang) {
        setRegNativeLang(userRef.current.native_language || userRef.current.default_source_lang || 'ru');
      }
      if (userRef.current?.target_language || userRef.current?.default_target_lang) {
        setRegTargetLang(userRef.current.target_language || userRef.current.default_target_lang || 'en');
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

  // Delete lesson from Lessons view
  const handleDeleteLesson = useCallback(
    async (lesson: Lesson) => {
      try {
        triggerHaptic('impact');
        if (lesson.id) {
          await deleteLesson(lesson.id);
        }
        triggerHaptic('success');

        // Optimistically remove from backend lessons state
        setBackendLessons((prev) => prev.filter((l) => l.id !== lesson.id));

        // If currently open lesson was deleted, close detail view
        setActiveLesson((curr) => (curr && curr.id === lesson.id ? null : curr));

        // Refresh lessons in background to ensure consistency
        loadLessons();
      } catch (err) {
        triggerHaptic('error');
        console.error('Failed to delete lesson:', err);
      }
    },
    [loadLessons]
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

  const handleProfileSwitch = useCallback(async () => {
    await loadProfiles();
    const updatedUser = await fetchMe().catch(() => null);
    if (updatedUser) {
      setUser(updatedUser);
      localStorage.setItem('ll_user', JSON.stringify(updatedUser));
    }
    await Promise.all([loadDeck(), loadWordlist(), loadLessons()]);
  }, [loadProfiles, loadDeck, loadWordlist, loadLessons]);

  // Expose methods globally for testing / verification
  useEffect(() => {
    (window as any).loadDeck = loadDeck;
    (window as any).loadWordlist = loadWordlist;
    (window as any).submitRating = submitRating;
    (window as any).restartDeck = handleRestartDeck;
    (window as any).setActiveLesson = setActiveLesson;
    (window as any).setActivePage = setActivePage;
    (window as any).deleteLesson = handleDeleteLesson;
  }, [loadDeck, loadWordlist, submitRating, handleRestartDeck, handleDeleteLesson]);

  // Initial boot
  useEffect(() => {
    initTelegram();
    loadLanguages();
    checkAuth().then(() => {
      if (tokenRef.current) {
        loadProfiles().then(() => {
          loadDeck();
          loadWordlist();
          loadLessons();
        });
      }
    });
  }, [checkAuth, loadLanguages, loadProfiles, loadDeck, loadWordlist, loadLessons]);

  // Reload wordlist and lessons when navigating to Wordlist, Lessons, or Flashcards page
  useEffect(() => {
    if (isAuthenticated) {
      if (activePage === 'wordlist' || activePage === 'lessons') {
        loadWordlist();
      }
      if (activePage === 'lessons') {
        loadLessons();
      }
      if (activePage === 'flashcards') {
        loadDeck();
      }
    }
  }, [isAuthenticated, activePage, loadWordlist, loadLessons, loadDeck]);

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

    const currentProfile = activeProfileRef.current || activeProfile;
    const source_lang = currentProfile?.source_language || (user && (user.native_language || user.default_source_lang)) || 'ru';
    const language_code =
      currentProfile?.target_language ||
      (user && (user.target_language || user.default_target_lang)) ||
      (languages && languages.length ? languages[0].code : 'en');

    setIsSending(true);
    try {
      const result = await submitText({
        text: raw,
        source_lang,
        target_lang: language_code,
        wait: true,
      });

      triggerHaptic('success');
      setQuickInput('');

      if (result.is_lesson && result.lesson) {
        await loadLessons();
        await loadWordlist();
      } else if (result.words && result.words.length > 0) {
        const newWords: Word[] = result.words;
        const ids = new Set(newWords.map((w) => w.id));
        const newCards: FlashcardItem[] = newWords.map((w) => ({
          ...w,
          stats: w.user_stats || null,
          user_stats: w.user_stats || null,
          is_new: true,
        }));
        setDeck((prevDeck) => {
          const filtered = prevDeck.filter((w) => !ids.has(w.id));
          return [...newCards, ...filtered];
        });
        setCurrentIndex(0);
        setIsFlipped(false);

        // Add to wordlist state
        setAllWords((prev) => {
          return [...newWords, ...prev.filter((w) => !ids.has(w.id))];
        });
      }

      // If multi-sentence text submitted (>1 sentences), prompt user to create a lesson from this text
      if (result.is_multi_sentence || (result.sentence_count !== undefined && result.sentence_count > 1) || result.can_create_lesson) {
        setMultiSentencePrompt({
          text: raw,
          words: result.words || [],
        });
      }
    } catch (err) {
      console.warn('submitText error, attempting fallback createWord:', err);
      let text = raw;
      let translation = raw;
      const match = raw.match(/^(.*?)\s*(?:[-–—=:]|->|=>)\s*(.+)$/);
      if (match && match[1].trim() && match[2].trim()) {
        text = match[1].trim();
        translation = match[2].trim();
      }

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

        setAllWords((prev) => [newWord, ...prev.filter((w) => w.id !== newWord.id)]);
        loadDeck(newWord.id, newCard).catch((e) => console.warn('loadDeck failed:', e));
        loadWordlist().catch((e) => console.warn('loadWordlist failed:', e));
      } catch (fallbackErr) {
        triggerHaptic('error');
        console.error('Failed to add word:', fallbackErr);
      }
    } finally {
      setIsSending(false);
    }
  };

  // Generate Quiz Lesson from Multi-sentence Prompt
  const handleGenerateQuizFromPrompt = async () => {
    if (!multiSentencePrompt) return;
    setIsGeneratingQuiz(true);
    try {
      const currentProfile = activeProfileRef.current || activeProfile;
      const source_lang = currentProfile?.source_language || (user && (user.native_language || user.default_source_lang)) || 'ru';
      const target_lang = currentProfile?.target_language || (user && (user.target_language || user.default_target_lang)) || 'en';
      const newLesson = await generateQuizLesson({
        text: multiSentencePrompt.text,
        word_ids: multiSentencePrompt.words.map((w) => w.id),
        source_lang,
        target_lang,
      });
      triggerHaptic('success');
      setMultiSentencePrompt(null);
      await loadLessons();
      await loadWordlist();
      if (newLesson) {
        setActiveLesson(newLesson);
        setActivePage('lessons');
      }
    } catch (err) {
      triggerHaptic('error');
      console.error('Failed to generate quiz lesson:', err);
    } finally {
      setIsGeneratingQuiz(false);
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
    const lang = currentCard?.language_code || activeProfileRef.current?.target_language || user?.target_language || user?.default_target_lang || 'en';
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
      await loadProfiles();
      loadDeck();
      loadWordlist();
      loadLessons();
    } catch (err: any) {
      setAuthError(err.message || 'Invalid username or password');
      triggerHaptic('error');
    }
  };

  // User settings update handler
  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('ll_user', JSON.stringify(updatedUser));
  };

  // Register submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername || !regPassword) {
      setAuthError('Please fill in all fields');
      return;
    }

    try {
      const res = await registerUser({
        username: regUsername,
        password: regPassword,
        native_language: regNativeLang || 'ru',
        target_language: regTargetLang || 'en',
        default_source_lang: regNativeLang || 'ru',
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
      await loadProfiles();
      loadDeck();
      loadWordlist();
      loadLessons();
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
      triggerHaptic('error');
    }
  };

  // Quick Demo Login
  const handleQuickDemoLogin = async () => {
    const demoUser = {
      username: 'demo_student',
      password: 'demopassword123',
      native_language: 'ru',
      target_language: 'en',
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
      await loadProfiles();
      loadDeck();
      loadWordlist();
      loadLessons();
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
        await loadProfiles();
        loadDeck();
        loadWordlist();
        loadLessons();
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
    setProfiles([]);
    setActiveProfile(null);
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
        languages={languages}
        onToggleMenu={() => setIsMenuOpen((prev) => !prev)}
        onNavigate={handleNavigate}
        onProfileSwitch={handleProfileSwitch}
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
            regPassword={regPassword}
            regNativeLang={regNativeLang}
            regTargetLang={regTargetLang}
            onTabChange={(tab) => {
              setAuthTab(tab);
              setAuthError(null);
            }}
            onLoginIdentifierChange={setLoginIdentifier}
            onLoginPasswordChange={setLoginPassword}
            onRegUsernameChange={setRegUsername}
            onRegPasswordChange={setRegPassword}
            onRegNativeLangChange={setRegNativeLang}
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
                  backendLessons={backendLessons}
                  isLoading={isWordsLoading}
                  onSelectLesson={(lesson) => setActiveLesson(lesson)}
                  onDeleteLesson={handleDeleteLesson}
                  onRefresh={() => {
                    loadWordlist();
                    loadLessons();
                  }}
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
            ) : activePage === 'wordlist' ? (
              <WordlistView
                words={allWords}
                isLoading={isWordsLoading}
                onDeleteWord={handleDeleteWord}
                onRefresh={loadWordlist}
              />
            ) : (
              <SettingsView
                user={user}
                onUpdateUser={handleUpdateUser}
                onLogout={handleLogout}
              />
            )}
          </main>

          {/* Pinned Bottom Word Input Dock - Hidden on active lesson view and settings page */}
          {!activeLesson && activePage !== 'settings' && (
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

          {/* Multi-sentence Quiz Lesson Generation Modal Prompt */}
          {multiSentencePrompt && (
            <div id="multi-sentence-modal" className="modal-backdrop" role="dialog" aria-modal="true">
              <div className="modal-card">
                <div className="modal-header">
                  <div className="modal-icon">🎯</div>
                  <h3 className="modal-title">Create Lesson</h3>
                  <button
                    id="btn-close-modal"
                    className="modal-close-btn"
                    onClick={() => setMultiSentencePrompt(null)}
                    aria-label="Close modal"
                  >
                    ✕
                  </button>
                </div>
                <p className="modal-body-text">
                  Do you want to create a lesson from this text?
                </p>
                <div className="modal-actions">
                  <button
                    id="btn-generate-quiz-lesson"
                    className="btn btn-primary btn-full"
                    disabled={isGeneratingQuiz}
                    onClick={handleGenerateQuizFromPrompt}
                  >
                    {isGeneratingQuiz ? '⏳ Generating Quiz with AI...' : '🎯 Generate Quiz Lesson'}
                  </button>
                  <button
                    id="btn-dismiss-quiz-prompt"
                    className="btn btn-outline btn-full"
                    disabled={isGeneratingQuiz}
                    onClick={() => setMultiSentencePrompt(null)}
                  >
                    Keep Words Only
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;