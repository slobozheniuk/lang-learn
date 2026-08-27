import { FlashcardItem, Word } from '../types';

/**
 * Calculates the recall rate percentage for a word based on user stats.
 * Returns an integer between 0 and 100.
 */
export function getRecallRate(word: Word | FlashcardItem): number {
  const stats: any = word.user_stats || (word as any).stats;
  if (!stats) return 0;
  const recall = typeof stats.recall_count === 'number' ? stats.recall_count : 0;
  const fail = typeof stats.fail_count === 'number' ? stats.fail_count : 0;
  const total = recall + fail;
  if (total === 0) return 0;
  return Math.round((recall / total) * 100);
}

/**
 * Maps a recall rate percentage (0-100) to its color tier:
 * - red: 0% to 50%
 * - yellow: 50% to 75%
 * - green: 75% to 99%
 * - perfect: 100% (green badge + vibrant green panel border)
 */
export function getRecallStatus(rate: number): 'red' | 'yellow' | 'green' | 'perfect' {
  if (rate <= 50) return 'red';
  if (rate < 75) return 'yellow';
  if (rate < 100) return 'green';
  return 'perfect';
}

/**
 * Telegram Web App SDK initialization helper.
 */
export function initTelegram() {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    try {
      (window as any).Telegram.WebApp.ready();
      (window as any).Telegram.WebApp.expand();
    } catch (e) {
      console.warn('Telegram WebApp init:', e);
    }
  }
}

/**
 * Haptic feedback trigger for Telegram Web App.
 */
export function triggerHaptic(type: 'impact' | 'success' | 'error' = 'impact') {
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

/**
 * Speech synthesis helper for word pronunciation.
 */
export function pronounceWord(text: string, langCode: string = 'en') {
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
