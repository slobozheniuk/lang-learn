/**
 * Pronounces text using Web Speech API or custom audio URL
 */
export function playPronunciation(text: string, langCode: string = 'en', audioUrl?: string | null): void {
  if (audioUrl) {
    const audio = new Audio(audioUrl);
    audio.play().catch((err) => {
      console.warn('Audio URL playback failed, falling back to Web Speech:', err);
      speakWithWebSpeech(text, langCode);
    });
    return;
  }

  speakWithWebSpeech(text, langCode);
}

function speakWithWebSpeech(text: string, langCode: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  
  // Map simple lang codes to full BCP 47 tags
  const langMap: Record<string, string> = {
    en: 'en-US',
    nl: 'nl-NL',
    ru: 'ru-RU',
    de: 'de-DE',
    fr: 'fr-FR',
    es: 'es-ES',
    it: 'it-IT',
  };

  utterance.lang = langMap[langCode.toLowerCase()] || langCode;
  utterance.rate = 0.9; // Slightly slower for language learners

  window.speechSynthesis.speak(utterance);
}
