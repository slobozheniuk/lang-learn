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
    if (state.token && state.user) {
      el.authNav.innerHTML = `
        <div class="user-badge" title="Logged in as ${state.user.username}">
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
        btnOpenLogin.addEventListener('click', () => {
          openAuthModal('login');
        });
      }
    }
  }

  function openAuthModal(tab = 'login') {
    state.authModalTab = tab;
    el.authAlert.classList.remove('show');
    el.authAlert.textContent = '';
    switchAuthTab(tab);
    el.authModal.classList.add('is-open');
  }

  function closeAuthModal() {
    el.authModal.classList.remove('is-open');
  }

  function switchAuthTab(tab) {
    state.authModalTab = tab;
    if (tab === 'login') {
      el.tabLogin.classList.add('active');
      el.tabRegister.classList.remove('active');
      el.loginForm.style.display = 'flex';
      el.registerForm.style.display = 'none';
    } else {
      el.tabRegister.classList.add('active');
      el.tabLogin.classList.remove('active');
      el.loginForm.style.display = 'none';
      el.registerForm.style.display = 'flex';
    }
    el.authAlert.classList.remove('show');
  }

  function showAuthError(msg) {
    el.authAlert.textContent = msg;
    el.authAlert.classList.add('show');
    triggerHaptic('error');
  }

  // --- Languages ---
  async function loadLanguages() {
    try {
      const langs = await api('/api/v1/languages/');
      state.languages = langs;
      const regTargetLang = document.getElementById('reg-target-lang');
      if (regTargetLang) {
        regTargetLang.innerHTML = '';
        langs.forEach(lang => {
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

        // Immediately refresh flashcards deck and select newly added word
        await loadDeck(newWord.id);
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
  async function loadDeck(selectWordId = null) {
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
      state.deck = [];
      state.currentIndex = 0;
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

    // Front
    if (el.cardWord) el.cardWord.textContent = card.text;
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
    state.isFlipped = flipped;
    if (el.flashcard) {
      if (flipped) {
        el.flashcard.classList.add('is-flipped');
      } else {
        el.flashcard.classList.remove('is-flipped');
      }
    }
  }

  function toggleFlip() {
    setFlipped(!state.isFlipped);
    triggerHaptic('impact');
  }

  // --- Pronunciation / Audio ---
  function pronounceWord(text, langCode = 'en') {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (langCode === 'nl') utterance.lang = 'nl-NL';
      else if (langCode === 'ru') utterance.lang = 'ru-RU';
      else utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  if (el.btnAudio) {
    el.btnAudio.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.deck.length > 0) {
        const card = state.deck[state.currentIndex];
        pronounceWord(card.text, card.language_code);
        triggerHaptic('impact');
      }
    });
  }

  // --- SRS Rating Submission ---
  async function submitRating(rating) {
    if (state.deck.length === 0) return;
    const card = state.deck[state.currentIndex];

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

  // --- Event Listeners ---
  // Card Flip
  if (el.flashcard) {
    el.flashcard.addEventListener('click', () => toggleFlip());
  }

  // SRS Rating Buttons (✕ / Forgot -> again, ✓ / Remembered -> good)
  document.querySelectorAll('.srs-btn[data-rating]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rating = btn.getAttribute('data-rating') || 'again';
      submitRating(rating);
    });
  });

  // Modal handlers
  if (el.modalCloseBtn) el.modalCloseBtn.addEventListener('click', closeAuthModal);
  if (el.authModal) {
    el.authModal.addEventListener('click', (e) => {
      if (e.target === el.authModal) closeAuthModal();
    });
  }
  if (el.tabLogin) el.tabLogin.addEventListener('click', () => switchAuthTab('login'));
  if (el.tabRegister) el.tabRegister.addEventListener('click', () => switchAuthTab('register'));

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
    await checkAuth();
    await loadLanguages();
    await loadDeck();
  }

  init();
})();
