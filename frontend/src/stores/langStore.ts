import { create } from 'zustand';
import { languagesApi } from '../api/languages';
import { Language, LanguagePair } from '../types';

export const DEFAULT_LANGUAGE_PAIRS: LanguagePair[] = [
  { source: 'ru', target: 'nl', label: '🇷🇺 RU → 🇳🇱 NL' },
  { source: 'ru', target: 'en', label: '🇷🇺 RU → 🇬🇧 EN' },
  { source: 'en', target: 'nl', label: '🇬🇧 EN → 🇳🇱 NL' },
];

interface LangState {
  languages: Language[];
  sourceLang: string;
  targetLang: string;
  availablePairs: LanguagePair[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchLanguages: () => Promise<void>;
  setLanguagePair: (source: string, target: string) => void;
  setSourceLang: (source: string) => void;
  setTargetLang: (target: string) => void;
}

const getSavedPair = () => {
  if (typeof localStorage === 'undefined') {
    return { source: 'ru', target: 'nl' };
  }
  const savedSource = localStorage.getItem('lang_source') || 'ru';
  const savedTarget = localStorage.getItem('lang_target') || 'nl';
  return { source: savedSource, target: savedTarget };
};

export const useLangStore = create<LangState>((set, get) => {
  const initial = getSavedPair();

  return {
    languages: [
      { code: 'ru', name: 'Russian', created_at: '' },
      { code: 'en', name: 'English', created_at: '' },
      { code: 'nl', name: 'Dutch', created_at: '' },
    ],
    sourceLang: initial.source,
    targetLang: initial.target,
    availablePairs: DEFAULT_LANGUAGE_PAIRS,
    isLoading: false,
    error: null,

    fetchLanguages: async () => {
      set({ isLoading: true });
      try {
        const langs = await languagesApi.getLanguages();
        if (langs && langs.length > 0) {
          set({ languages: langs, isLoading: false });
        } else {
          set({ isLoading: false });
        }
      } catch (err: any) {
        // Keep fallback languages if backend is offline/mock
        set({ isLoading: false, error: err.message });
      }
    },

    setLanguagePair: (source: string, target: string) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('lang_source', source);
        localStorage.setItem('lang_target', target);
      }
      set({ sourceLang: source, targetLang: target });
    },

    setSourceLang: (source: string) => {
      get().setLanguagePair(source, get().targetLang);
    },

    setTargetLang: (target: string) => {
      get().setLanguagePair(get().sourceLang, target);
    },
  };
});
