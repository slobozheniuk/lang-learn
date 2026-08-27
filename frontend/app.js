/**
 * LinguaFlash — Pure Vanilla JS Frontend
 * High performance, zero dependencies, Telegram Web App ready.
 */

(function () {
  'use strict';

  // --- Telegram Web App SDK Initialization ---
  if (window.Telegram && window.Telegram.WebApp) {
    try {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    } catch (e) {
      console.warn('Telegram WebApp init:', e);
    }
  }

  function triggerHaptic(type = 'impact') {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
      try {
        if (type === 'impact') {
          window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        } else if (type === 'success') {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        } else if (type === 'error') {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        }
      } catch (e) {
        // Ignore haptic errors
      }
    }
  }

  // --- State ---
  const state = {
    token: localStorage.getItem('ll_token') || null,
    user: JSON.parse(localStorage.getItem('ll_user') || 'null'),
    languages: [],
    deck: [],
    currentIndex: 0,
    deckMode: 'due',
    isFlipped: false,
    authModalTab: 'login', // 'login' or 'register'
  };

  // --- DOM Elements ---
  const el = {
    // Header & Auth
    authNav: document.getElementById('auth-nav'),
    authModal: document.getElementById('auth-modal'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    tabLogin: document.getElementById('tab-login'),
    tabRegister: document.getElementById('tab-register'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    authAlert: document.getElementById('auth-alert'),
    quickDemoBtn: document.getElementById('quick-demo-btn'),

    // Floating Quick Add Word Dock
    quickWordForm: document.getElementById('quick-word-form'),
    quickWordInput: document.getElementById('quick-word-input'),
    btnQuickSend: document.getElementById('btn-quick-send'),

    // Flashcard View
    flashcardScene: document.getElementById('flashcard-scene'),
    flashcard: document.getElementById('flashcard'),
    cardWord: document.getElementById('card-word'),
    cardPhonetic: document.getElementById('card-phonetic'),
    cardTranslation: document.getElementById('card-translation'),
    cardContext: document.getElementById('card-context'),
    srsRatingsWrapper: document.getElementById('srs-ratings-wrapper'),
    btnAudio: document.getElementById('btn-audio'),
    emptyState: document.getElementById('empty-state'),
    emptyIcon: document.getElementById('empty-icon'),
    emptyTitle: document.getElementById('empty-title'),
    emptyDesc: document.getElementById('empty-desc'),
  };

  // --- API Client ---
  async function api(path, options = {}) {
    const headers = options.headers || {};
    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    try {
      const response = await fetch(path, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        // Token expired or invalid
        if (state.token) {
          clearAuth();
        }
      }

      const contentType = response.headers.get('content-type') || '';
      let data = null;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errorDetail = (data && data.detail) ? data.detail : `Error: ${response.statusText}`;
        const err = new Error(typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail));
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (error) {
      console.error(`API Error on ${path}:`, error);
      throw error;
    }
  }

  // --- Authentication ---
  function setAuth(token, user) {
    state.token = token;
    state.user = user;
    localStorage.setItem('ll_token', token);
    localStorage.setItem('ll_user', JSON.stringify(user));
    renderAuthNav();
    loadLanguages().then(() => loadDeck());
  }

  function clearAuth() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('ll_token');
    localStorage.removeItem('ll_user');
    renderAuthNav();
    loadDeck();
  }

  async function checkAuth() {
    if (!state.token) {
      renderAuthNav();
      return;
    }
    try {
      const user = await api('/api/v1/auth/me');
      state.user = user;
      localStorage.setItem('ll_user', JSON.stringify(user));
    } catch (e) {
      clearAuth();
    }
    renderAuthNav();
  }

  function renderAuthNav() {
    if (!el.authNav) return;
    if (state.token && state.user) {
      el.authNav.innerHTML = `
        <div class="user-badge" title="Logged in as ${escapeHtml(state.user.username)}">
          <span>👤</span>
          <span class="user-name">${escapeHtml(state.user.username)}</span>
        </div>
        <button id="btn-logout" class="btn btn-outline btn-sm">Sign Out</button>
      `;
      const btnLogout = document.getElementById('btn-logout');
      if (btnLogout) {
        btnLogout.addEventListener('click', () => {
          clearAuth();
        });
      }
    } else {
      el.authNav.innerHTML = `
        <button id="btn-open-login" class="btn btn-primary btn-sm">Sign In / Register</button>
      `;
      const btnOpenLogin = document.getElementById('btn-open-login');
      if (btnOpenLogin) {
        btnOpenLogin.addEventListener('click', (e) => {
          e.preventDefault();
          openAuthModal('login');
        });
      }
    }
  }

  function openAuthModal(tab = 'login') {
    const modal = el.authModal || document.getElementById('auth-modal');
    if (!modal) return;
    state.authModalTab = tab;
    if (el.authAlert) {
      el.authAlert.classList.remove('show');
      el.authAlert.textContent = '';
    }
    switchAuthTab(tab);
    modal.classList.add('is-open', 'open', 'active', 'show');
  }

  function closeAuthModal() {
    const modal = el.authModal || document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.remove('is-open', 'open', 'active', 'show');
  }

  function switchAuthTab(tab) {
    state.authModalTab = tab;
    const tabLogin = el.tabLogin || document.getElementById('tab-login');
    const tabRegister = el.tabRegister || document.getElementById('tab-register');
    const loginForm = el.loginForm || document.getElementById('login-form');
    const registerForm = el.registerForm || document.getElementById('register-form');
    const authAlert = el.authAlert || document.getElementById('auth-alert');

    if (tab === 'login') {
      if (tabLogin) tabLogin.classList.add('active');
      if (tabRegister) tabRegister.classList.remove('active');
      if (loginForm) loginForm.style.display = 'flex';
      if (registerForm) registerForm.style.display = 'none';
    } else {
      if (tabRegister) tabRegister.classList.add('active');
      if (tabLogin) tabLogin.classList.remove('active');
      if (loginForm) loginForm.style.display = 'none';
      if (registerForm) registerForm.style.display = 'flex';
    }
    if (authAlert) authAlert.classList.remove('show');
  }

  function showAuthError(msg) {
    const alert = el.authAlert || document.getElementById('auth-alert');
    if (alert) {
      alert.textContent = msg;
      alert.classList.add('show');
    }
    triggerHaptic('error');
  }

  // --- Languages ---
  async function loadLanguages() {
    try {
      const langs = await api('/api/v1/languages/');
      state.languages = langs || [];
      const regTargetLang = document.getElementById('reg-target-lang');
      if (regTargetLang) {
        regTargetLang.innerHTML = '';
        state.languages.forEach(lang => {
          const opt = document.createElement('option');
          opt.value = lang.code;
          opt.textContent = `${lang.name} (${lang.code.toUpperCase()})`;
          regTargetLang.appendChild(opt);
        });
        if (state.user && state.user.default_target_lang) {
          regTargetLang.value = state.user.default_target_lang;
        } else {
          regTargetLang.value = 'en';
        }
      }
    } catch (e) {
      console.warn('Failed to load languages:', e);
    }
  }

  // --- Quick Add Word (Floating Bottom Dock) ---
  if (el.quickWordForm) {
    el.quickWordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const raw = el.quickWordInput ? el.quickWordInput.value.trim() : '';
      if (!raw) return;

      if (!state.token) {
        openAuthModal('login');
        showAuthError('Please sign in or register to add words.');
        return;
      }

      // Parse single-box input: check for delimiter (e.g. "word - translation" or "word = translation" or "word: translation")
      let text = raw;
      let translation = raw;
      const match = raw.match(/^(.*?)\s*(?:[-–—=:]|->|=>)\s*(.+)$/);
      if (match && match[1].trim() && match[2].trim()) {
        text = match[1].trim();
        translation = match[2].trim();
      }

      // Auto-detect target language from active user default target language or available languages
      const language_code = (state.user && state.user.default_target_lang) || (state.languages && state.languages.length ? state.languages[0].code : 'en');

      if (el.btnQuickSend) {
        el.btnQuickSend.disabled = true;
      }

      try {
        const newWord = await api('/api/v1/words/', {
          method: 'POST',
          body: JSON.stringify({
            text,
            translation,
            language_code,
          }),
        });

        triggerHaptic('success');

        // Clear input box
        if (el.quickWordInput) {
          el.quickWordInput.value = '';
        }

        // Immediately update deck state and render new word on flashcard
        const newCard = {
          ...newWord,
          stats: null,
          is_new: true,
        };
        // Remove existing copy if present and place at active position
        state.deck = state.deck.filter(w => w.id !== newWord.id);
        state.deck.unshift(newCard);
        state.currentIndex = 0;
        renderDeck();

        // Also fetch updated due reviews in the background
        loadDeck(newWord.id, newCard).catch(err => console.warn('Background loadDeck failed:', err));
      } catch (err) {
        triggerHaptic('error');
        console.error('Failed to add word:', err);
      } finally {
        if (el.btnQuickSend) {
          el.btnQuickSend.disabled = false;
        }
      }
    });
  }

  // --- Flashcards & Review Deck ---
  async function loadDeck(selectWordId = null, fallbackWord = null) {
    state.isFlipped = false;

    try {
      let cards = [];
      if (state.token) {
        const dueItems = await api('/api/v1/review/due');
        cards = (dueItems || []).map(item => ({
          ...item.word,
          stats: item.stats,
          is_new: item.is_new,
        }));
      } else {
        // If not logged in, fetch general words
        const words = await api('/api/v1/words/?limit=50');
        cards = words || [];
      }

      if (fallbackWord) {
        const hasFallback = cards.some(w => w.id === fallbackWord.id);
        if (!hasFallback) {
          cards.unshift(fallbackWord);
        }
      }

      state.deck = cards;
      if (selectWordId) {
        const foundIdx = state.deck.findIndex(w => w.id === selectWordId);
        state.currentIndex = foundIdx >= 0 ? foundIdx : 0;
      } else {
        if (state.currentIndex >= state.deck.length) {
          state.currentIndex = Math.max(0, state.deck.length - 1);
        }
      }

      renderDeck();
    } catch (err) {
      console.error('Error loading deck:', err);
      if (fallbackWord) {
        state.deck = [fallbackWord];
        state.currentIndex = 0;
      } else {
        state.deck = [];
        state.currentIndex = 0;
      }
      renderDeck();
    }
  }

  function renderDeck() {
    setFlipped(false);

    if (state.deck.length === 0) {
      if (el.flashcardScene) el.flashcardScene.style.display = 'none';
      if (el.srsRatingsWrapper) el.srsRatingsWrapper.style.display = 'none';
      if (el.emptyState) el.emptyState.style.display = 'flex';
      return;
    }

    if (el.emptyState) el.emptyState.style.display = 'none';
    if (el.flashcardScene) el.flashcardScene.style.display = 'block';
    if (el.srsRatingsWrapper) el.srsRatingsWrapper.style.display = 'flex';

    const card = state.deck[state.currentIndex];
    if (!card) return;

    // Front
    if (el.cardWord) el.cardWord.textContent = card.text || '';
    if (el.cardPhonetic) {
      el.cardPhonetic.textContent = card.phonetic ? `[${card.phonetic}]` : (card.pos ? `(${card.pos})` : '');
    }

    // Back
    if (el.cardTranslation) el.cardTranslation.textContent = card.translation || '—';
    if (el.cardContext) {
      if (card.context_phrase) {
        el.cardContext.textContent = `"${card.context_phrase}"`;
        el.cardContext.style.display = 'block';
      } else {
        el.cardContext.style.display = 'none';
      }
    }
  }

  function setFlipped(flipped) {
    state.isFlipped = Boolean(flipped);
    const card = el.flashcard || document.getElementById('flashcard');
    if (card) {
      if (state.isFlipped) {
        card.classList.add('is-flipped', 'flipped');
        card.setAttribute('aria-expanded', 'true');
      } else {
        card.classList.remove('is-flipped', 'flipped');
        card.setAttribute('aria-expanded', 'false');
      }
    }
  }

  function toggleFlip() {
    setFlipped(!state.isFlipped);
    triggerHaptic('impact');
  }

  // --- Pronunciation / Audio ---
  function pronounceWord(text, langCode = 'en') {
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
        utterance.lang = code.includes('-') ? code : `${code}-${code.toUpperCase()}`;
      }
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.onerror = (e) => console.warn('Utterance error:', e);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  // --- SRS Rating Submission ---
  async function submitRating(rating) {
    if (state.deck.length === 0) return;
    const card = state.deck[state.currentIndex];
    if (!card) return;

    if (!state.token) {
      openAuthModal('login');
      showAuthError('Please sign in or register to record your review progress.');
      return;
    }

    try {
      if (rating === 'again') {
        triggerHaptic('error');
      } else {
        triggerHaptic('success');
      }

      await api('/api/v1/review/submit', {
        method: 'POST',
        body: JSON.stringify({
          word_id: card.id,
          rating: rating,
        }),
      });

      // Remove reviewed card from deck queue
      state.deck.splice(state.currentIndex, 1);
      if (state.currentIndex >= state.deck.length) {
        state.currentIndex = 0;
      }
      renderDeck();
    } catch (err) {
      triggerHaptic('error');
      console.error('Failed to submit review rating:', err);
    }
  }

  // --- Event Listeners & Delegations ---
  // Card Flip direct listener
  if (el.flashcard) {
    el.flashcard.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFlip();
    });
    el.flashcard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleFlip();
      }
    });
  }

  // Sound / Pronunciation Button
  if (el.btnAudio) {
    el.btnAudio.addEventListener('click', (e) => {
      e.stopPropagation();
      el.btnAudio.blur();
      let text = '';
      let lang = 'en';
      if (state.deck.length > 0 && state.currentIndex < state.deck.length) {
        const card = state.deck[state.currentIndex];
        text = card.text || '';
        lang = card.language_code || (state.user && state.user.default_target_lang) || 'en';
      }
      if (!text && el.cardWord) {
        text = el.cardWord.textContent.trim();
      }
      if (text) {
        pronounceWord(text, lang);
        triggerHaptic('impact');
      }
    });
  }

  // SRS Rating Buttons (✕ / Forgot -> again, ✓ / Remembered -> good)
  document.querySelectorAll('.srs-btn[data-rating]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      btn.blur();
      const rating = btn.getAttribute('data-rating') || 'again';
      submitRating(rating);
    });
  });

  // Modal close and tab switching
  if (el.modalCloseBtn) el.modalCloseBtn.addEventListener('click', closeAuthModal);
  if (el.authModal) {
    el.authModal.addEventListener('click', (e) => {
      if (e.target === el.authModal) closeAuthModal();
    });
  }
  if (el.tabLogin) el.tabLogin.addEventListener('click', () => switchAuthTab('login'));
  if (el.tabRegister) el.tabRegister.addEventListener('click', () => switchAuthTab('register'));

  // Global Click Delegation (ensures dynamic/static elements always react)
  document.addEventListener('click', (e) => {
    const openLoginBtn = e.target.closest('#btn-open-login, .btn-open-login');
    if (openLoginBtn) {
      e.preventDefault();
      openAuthModal('login');
      return;
    }

    const modalClose = e.target.closest('#modal-close-btn');
    if (modalClose) {
      e.preventDefault();
      closeAuthModal();
      return;
    }

    const tabBtn = e.target.closest('.modal-tab');
    if (tabBtn) {
      if (tabBtn.id === 'tab-login' || tabBtn.textContent.includes('Sign In')) {
        switchAuthTab('login');
      } else if (tabBtn.id === 'tab-register' || tabBtn.textContent.includes('Register')) {
        switchAuthTab('register');
      }
      return;
    }

    const audioBtn = e.target.closest('#btn-audio, .srs-btn-audio');
    if (audioBtn) {
      audioBtn.blur();
      return;
    }

    const srsBtn = e.target.closest('.srs-btn[data-rating]');
    if (srsBtn) {
      srsBtn.blur();
      return;
    }

    const card = e.target.closest('#flashcard, .flashcard');
    if (card && !e.target.closest('button, input, select, textarea, a')) {
      toggleFlip();
      return;
    }
  });

  // Login Submit
  if (el.loginForm) {
    el.loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username_or_email = document.getElementById('login-identifier').value.trim();
      const password = document.getElementById('login-password').value;

      if (!username_or_email || !password) {
        showAuthError('Please fill in all fields');
        return;
      }

      try {
        const res = await api('/api/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username_or_email, password }),
        });
        const token = res.access_token;
        state.token = token;
        localStorage.setItem('ll_token', token);
        const user = await api('/api/v1/auth/me');
        setAuth(token, user);
        closeAuthModal();
        triggerHaptic('success');
      } catch (err) {
        showAuthError(err.message || 'Invalid username or password');
      }
    });
  }

  // Register Submit
  if (el.registerForm) {
    el.registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('reg-username').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const default_target_lang = document.getElementById('reg-target-lang').value;

      if (!username || !email || !password) {
        showAuthError('Please fill in all fields');
        return;
      }

      try {
        const res = await api('/api/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            username,
            email,
            password,
            default_source_lang: 'ru',
            default_target_lang: default_target_lang || 'en',
          }),
        });

        const token = res.token.access_token;
        const user = res.user;
        setAuth(token, user);
        closeAuthModal();
        triggerHaptic('success');
      } catch (err) {
        showAuthError(err.message || 'Registration failed');
      }
    });
  }

  // Quick Demo Login Button
  if (el.quickDemoBtn) {
    el.quickDemoBtn.addEventListener('click', async () => {
      const demoUser = {
        username: 'demo_student',
        email: 'student@example.com',
        password: 'demopassword123',
        default_source_lang: 'ru',
        default_target_lang: 'en',
      };

      try {
        // Try login first
        const res = await api('/api/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            username_or_email: demoUser.username,
            password: demoUser.password,
          }),
        });
        const token = res.access_token;
        state.token = token;
        localStorage.setItem('ll_token', token);
        const user = await api('/api/v1/auth/me');
        setAuth(token, user);
        closeAuthModal();
      } catch (loginErr) {
        // If user doesn't exist, register
        try {
          const regRes = await api('/api/v1/auth/register', {
            method: 'POST',
            body: JSON.stringify(demoUser),
          });
          setAuth(regRes.token.access_token, regRes.user);
          closeAuthModal();
        } catch (regErr) {
          showAuthError(regErr.message || 'Quick demo login failed');
        }
      }
    });
  }

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAuthModal();
      return;
    }

    // Disable shortcuts when typing in inputs
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      toggleFlip();
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
  });

  // Helpers
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Initial Boot ---
  async function init() {
    renderAuthNav();
    await checkAuth();
    await loadLanguages();
    await loadDeck();
  }

  init();
})();
