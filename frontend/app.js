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
    deckMode: 'due', // 'due' or 'all'
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

    // Add Word Form
    wordForm: document.getElementById('word-form'),
    wordText: document.getElementById('word-text'),
    wordTranslation: document.getElementById('word-translation'),
    wordContext: document.getElementById('word-context'),
    wordLang: document.getElementById('word-lang'),
    btnAddWord: document.getElementById('btn-add-word'),

    // Flashcard View
    deckTabDue: document.getElementById('tab-due'),
    deckTabAll: document.getElementById('tab-all'),
    deckCounter: document.getElementById('deck-counter'),
    flashcardScene: document.getElementById('flashcard-scene'),
    flashcard: document.getElementById('flashcard'),
    cardTag: document.getElementById('card-tag'),
    cardWord: document.getElementById('card-word'),
    cardPhonetic: document.getElementById('card-phonetic'),
    cardAudioBtn: document.getElementById('card-audio-btn'),
    cardTranslation: document.getElementById('card-translation'),
    cardContext: document.getElementById('card-context'),
    cardStats: document.getElementById('card-stats'),
    srsRatingsWrapper: document.getElementById('srs-ratings-wrapper'),
    emptyState: document.getElementById('empty-state'),
    emptyIcon: document.getElementById('empty-icon'),
    emptyTitle: document.getElementById('empty-title'),
    emptyDesc: document.getElementById('empty-desc'),
    emptyActionBtn: document.getElementById('empty-action-btn'),

    // Nav buttons
    btnPrevCard: document.getElementById('btn-prev-card'),
    btnFlipCard: document.getElementById('btn-flip-card'),
    btnNextCard: document.getElementById('btn-next-card'),
    btnDeleteCard: document.getElementById('btn-delete-card'),

    // Toast
    toastContainer: document.getElementById('toast-container'),
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
          showToast('Session expired. Please log in again.', 'error');
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

  // --- Toast Notification ---
  function showToast(message, type = 'normal') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
    toast.innerHTML = `<span>${message}</span>`;
    el.toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // --- Authentication ---
  function setAuth(token, user) {
    state.token = token;
    state.user = user;
    localStorage.setItem('ll_token', token);
    localStorage.setItem('ll_user', JSON.stringify(user));
    renderAuthNav();
    loadLanguages().then(() => loadDeck(state.deckMode));
  }

  function clearAuth() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('ll_token');
    localStorage.removeItem('ll_user');
    renderAuthNav();
    loadDeck(state.deckMode);
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
      document.getElementById('btn-logout').addEventListener('click', () => {
        clearAuth();
        showToast('Signed out successfully');
      });
    } else {
      el.authNav.innerHTML = `
        <button id="btn-open-login" class="btn btn-primary btn-sm">Sign In / Register</button>
      `;
      document.getElementById('btn-open-login').addEventListener('click', () => {
        openAuthModal('login');
      });
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
      el.wordLang.innerHTML = '';
      langs.forEach(lang => {
        const opt = document.createElement('option');
        opt.value = lang.code;
        opt.textContent = `${lang.name} (${lang.code.toUpperCase()})`;
        el.wordLang.appendChild(opt);
      });
      // Default to English or user's default_target_lang
      if (state.user && state.user.default_target_lang) {
        el.wordLang.value = state.user.default_target_lang;
      } else {
        el.wordLang.value = 'en';
      }
    } catch (e) {
      console.warn('Failed to load languages:', e);
    }
  }

  // --- Add Word Form ---
  el.wordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = el.wordText.value.trim();
    const translation = el.wordTranslation.value.trim();
    const context_phrase = el.wordContext.value.trim() || null;
    const language_code = el.wordLang.value || 'en';

    if (!text || !translation) {
      showToast('Please enter both word and translation', 'error');
      return;
    }

    if (!state.token) {
      openAuthModal('login');
      showAuthError('Please sign in or register to add words.');
      return;
    }

    el.btnAddWord.disabled = true;
    el.btnAddWord.textContent = 'Adding...';

    try {
      const newWord = await api('/api/v1/words/', {
        method: 'POST',
        body: JSON.stringify({
          text,
          translation,
          context_phrase,
          language_code,
        }),
      });

      triggerHaptic('success');
      showToast(`✓ Added "${newWord.text}" to your deck!`, 'success');

      // Clear inputs
      el.wordText.value = '';
      el.wordTranslation.value = '';
      el.wordContext.value = '';
      el.wordText.focus();

      // Refresh deck and select the newly added word
      await loadDeck(state.deckMode, newWord.id);
    } catch (err) {
      triggerHaptic('error');
      showToast(err.message || 'Failed to add word', 'error');
    } finally {
      el.btnAddWord.disabled = false;
      el.btnAddWord.textContent = '➕ Add Word';
    }
  });

  // --- Flashcards & Review Deck ---
  async function loadDeck(mode = 'due', selectWordId = null) {
    state.deckMode = mode;
    state.isFlipped = false;
    updateDeckTabs();

    try {
      let cards = [];
      if (mode === 'due') {
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
      } else {
        // 'all' words
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

  function updateDeckTabs() {
    if (state.deckMode === 'due') {
      el.deckTabDue.classList.add('active');
      el.deckTabAll.classList.remove('active');
    } else {
      el.deckTabAll.classList.add('active');
      el.deckTabDue.classList.remove('active');
    }
  }

  function renderDeck() {
    setFlipped(false);

    if (state.deck.length === 0) {
      el.flashcardScene.style.display = 'none';
      el.srsRatingsWrapper.style.display = 'none';
      el.deckCounter.textContent = '0 cards';
      el.emptyState.style.display = 'flex';

      if (state.deckMode === 'due') {
        el.emptyIcon.textContent = '🎉';
        el.emptyTitle.textContent = 'All caught up!';
        el.emptyDesc.textContent = 'No cards currently due for review. Add more words above or practice all cards in your deck.';
        el.emptyActionBtn.style.display = 'inline-flex';
        el.emptyActionBtn.textContent = 'Review All Flashcards';
        el.emptyActionBtn.onclick = () => loadDeck('all');
      } else {
        el.emptyIcon.textContent = '✨';
        el.emptyTitle.textContent = 'No flashcards yet';
        el.emptyDesc.textContent = 'Add your first word using the form above to start learning!';
        el.emptyActionBtn.style.display = 'none';
      }
      return;
    }

    el.emptyState.style.display = 'none';
    el.flashcardScene.style.display = 'block';
    el.srsRatingsWrapper.style.display = 'flex';

    const card = state.deck[state.currentIndex];
    el.deckCounter.textContent = `Card ${state.currentIndex + 1} of ${state.deck.length}`;

    // Front
    el.cardTag.textContent = (card.language_code || 'EN').toUpperCase();
    el.cardWord.textContent = card.text;
    el.cardPhonetic.textContent = card.phonetic ? `[${card.phonetic}]` : (card.pos ? `(${card.pos})` : '');

    // Back
    el.cardTranslation.textContent = card.translation || '—';
    if (card.context_phrase) {
      el.cardContext.textContent = `"${card.context_phrase}"`;
      el.cardContext.style.display = 'block';
    } else {
      el.cardContext.style.display = 'none';
    }

    // Stats pill
    if (card.user_stats || card.stats) {
      const s = card.user_stats || card.stats;
      el.cardStats.textContent = `Rep: ${s.repetition_number || 0} • Interval: ${(s.interval_days || 0).toFixed(1)}d • EF: ${(s.ease_factor || 2.5).toFixed(2)}`;
      el.cardStats.style.display = 'inline-block';
    } else {
      el.cardStats.textContent = 'New Card';
      el.cardStats.style.display = 'inline-block';
    }
  }

  function setFlipped(flipped) {
    state.isFlipped = flipped;
    if (flipped) {
      el.flashcard.classList.add('is-flipped');
    } else {
      el.flashcard.classList.remove('is-flipped');
    }
  }

  function toggleFlip() {
    setFlipped(!state.isFlipped);
    triggerHaptic('impact');
  }

  function nextCard() {
    if (state.deck.length === 0) return;
    state.currentIndex = (state.currentIndex + 1) % state.deck.length;
    renderDeck();
  }

  function prevCard() {
    if (state.deck.length === 0) return;
    state.currentIndex = (state.currentIndex - 1 + state.deck.length) % state.deck.length;
    renderDeck();
  }

  // --- Pronunciation / Audio ---
  function pronounceWord(text, langCode = 'en') {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (langCode === 'nl') utterance.lang = 'nl-NL';
    else if (langCode === 'ru') utterance.lang = 'ru-RU';
    else utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }

  el.cardAudioBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.deck.length > 0) {
      const card = state.deck[state.currentIndex];
      pronounceWord(card.text, card.language_code);
      triggerHaptic('impact');
    }
  });

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
      triggerHaptic('impact');
      await api('/api/v1/review/submit', {
        method: 'POST',
        body: JSON.stringify({
          word_id: card.id,
          rating: rating,
        }),
      });

      showToast(`Rated "${rating.toUpperCase()}"`, 'normal');

      // In 'due' mode, remove this card from queue or reload
      if (state.deckMode === 'due') {
        state.deck.splice(state.currentIndex, 1);
        if (state.currentIndex >= state.deck.length) {
          state.currentIndex = 0;
        }
        renderDeck();
      } else {
        nextCard();
      }
    } catch (err) {
      triggerHaptic('error');
      showToast(err.message || 'Failed to submit review rating', 'error');
    }
  }

  // --- Card Delete ---
  async function deleteCurrentCard() {
    if (state.deck.length === 0) return;
    const card = state.deck[state.currentIndex];
    if (!confirm(`Are you sure you want to delete "${card.text}"?`)) return;

    if (!state.token) {
      openAuthModal('login');
      return;
    }

    try {
      await api(`/api/v1/words/${card.id}`, { method: 'DELETE' });
      triggerHaptic('success');
      showToast(`Deleted "${card.text}"`, 'normal');
      state.deck.splice(state.currentIndex, 1);
      if (state.currentIndex >= state.deck.length) {
        state.currentIndex = Math.max(0, state.deck.length - 1);
      }
      renderDeck();
    } catch (err) {
      showToast(err.message || 'Failed to delete word', 'error');
    }
  }

  // --- Event Listeners ---
  // Deck Tabs
  el.deckTabDue.addEventListener('click', () => loadDeck('due'));
  el.deckTabAll.addEventListener('click', () => loadDeck('all'));

  // Card Flip & Controls
  el.flashcard.addEventListener('click', () => toggleFlip());
  el.btnFlipCard.addEventListener('click', () => toggleFlip());
  el.btnNextCard.addEventListener('click', () => nextCard());
  el.btnPrevCard.addEventListener('click', () => prevCard());
  el.btnDeleteCard.addEventListener('click', () => deleteCurrentCard());

  // SRS Rating Buttons
  document.querySelectorAll('.srs-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rating = btn.getAttribute('data-rating');
      submitRating(rating);
    });
  });

  // Modal handlers
  el.modalCloseBtn.addEventListener('click', closeAuthModal);
  el.authModal.addEventListener('click', (e) => {
    if (e.target === el.authModal) closeAuthModal();
  });
  el.tabLogin.addEventListener('click', () => switchAuthTab('login'));
  el.tabRegister.addEventListener('click', () => switchAuthTab('register'));

  // Login Submit
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
      showToast(`Welcome back, ${user.username}!`, 'success');
      triggerHaptic('success');
    } catch (err) {
      showAuthError(err.message || 'Invalid username or password');
    }
  });

  // Register Submit
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
      showToast(`Account created! Welcome, ${user.username}!`, 'success');
      triggerHaptic('success');
    } catch (err) {
      showAuthError(err.message || 'Registration failed');
    }
  });

  // Quick Demo Login Button
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
      showToast(`Signed in as demo student!`, 'success');
    } catch (loginErr) {
      // If user doesn't exist, register
      try {
        const regRes = await api('/api/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify(demoUser),
        });
        setAuth(regRes.token.access_token, regRes.user);
        closeAuthModal();
        showToast(`Demo student created and signed in!`, 'success');
      } catch (regErr) {
        showAuthError(regErr.message || 'Quick demo login failed');
      }
    }
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Disable shortcuts when typing in inputs
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      return;
    }

    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      toggleFlip();
    } else if (e.key === '1') {
      submitRating('again');
    } else if (e.key === '2') {
      submitRating('hard');
    } else if (e.key === '3') {
      submitRating('good');
    } else if (e.key === '4') {
      submitRating('easy');
    } else if (e.key === 'ArrowLeft') {
      prevCard();
    } else if (e.key === 'ArrowRight') {
      nextCard();
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
    await loadDeck('due');
  }

  init();
})();
