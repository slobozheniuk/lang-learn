import { AuthResponse, DueReviewItem, Language, RegisterResponse, User, Word, LearningProfile } from './types';

let currentToken: string | null = typeof localStorage !== 'undefined' ? localStorage.getItem('ll_token') : null;

export function setApiToken(token: string | null) {
  currentToken = token;
  if (typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem('ll_token', token);
    } else {
      localStorage.removeItem('ll_token');
    }
  }
}

export function getApiToken(): string | null {
  return currentToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('ll_token') : null);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getApiToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(path, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      if (token) {
        setApiToken(null);
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('ll_user');
        }
      }
    }

    const contentType = response.headers.get('content-type') || '';
    let data: any = null;
    if (response.status === 204) {
      data = null;
    } else if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorDetail = data && data.detail ? data.detail : `Error: ${response.statusText}`;
      const err: any = new Error(typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail));
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data as T;
  } catch (error) {
    console.error(`API Error on ${path}:`, error);
    throw error;
  }
}

export async function fetchMe(): Promise<User> {
  return api<User>('/api/v1/auth/me');
}

export async function loginUser(body: { username_or_email: string; password: string }): Promise<AuthResponse> {
  return api<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function registerUser(body: {
  username: string;
  email?: string;
  password: string;
  native_language?: string;
  target_language?: string;
  default_source_lang?: string;
  default_target_lang?: string;
}): Promise<RegisterResponse> {
  return api<RegisterResponse>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateUserSettings(body: {
  native_language?: string;
  target_language?: string;
  default_source_lang?: string;
  default_target_lang?: string;
  username?: string;
  email?: string;
}): Promise<User> {
  return api<User>('/api/v1/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function fetchLanguages(): Promise<Language[]> {
  return api<Language[]>('/api/v1/languages/');
}

export async function fetchWords(
  limit: number = 100,
  skip: number = 0,
  languageCode?: string,
  search?: string
): Promise<Word[]> {
  const params = new URLSearchParams();
  params.set('limit', limit.toString());
  params.set('skip', skip.toString());
  if (languageCode) params.set('language_code', languageCode);
  if (search) params.set('search', search);
  return api<Word[]>(`/api/v1/words/?${params.toString()}`);
}

export async function fetchDueReviews(targetLang?: string): Promise<DueReviewItem[]> {
  const params = targetLang ? `?target_lang=${encodeURIComponent(targetLang)}` : '';
  return api<DueReviewItem[]>(`/api/v1/review/due${params}`);
}

export async function createWord(body: {
  text: string;
  translation: string;
  language_code: string;
  context_phrase?: string;
  phonetic?: string;
  pos?: string;
}): Promise<Word> {
  return api<Word>('/api/v1/words/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function submitText(body: {
  text: string;
  source_lang?: string;
  target_lang?: string;
  wait?: boolean;
}): Promise<any> {
  return api('/api/v1/words/submit-text', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchLessons(sourceLang?: string, targetLang?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (sourceLang) params.set('source_lang', sourceLang);
  if (targetLang) params.set('target_lang', targetLang);
  const query = params.toString() ? `?${params.toString()}` : '';
  return api<any[]>(`/api/v1/lessons/${query}`);
}

export async function fetchLesson(lessonId: number): Promise<any> {
  return api<any>(`/api/v1/lessons/${lessonId}`);
}

export async function fetchJob(jobId: string): Promise<any> {
  return api(`/api/v1/jobs/${jobId}`);
}

export async function deleteWord(wordId: number): Promise<void> {
  return api<void>(`/api/v1/words/${wordId}`, {
    method: 'DELETE',
  });
}

export async function deleteLesson(lessonId: number): Promise<void> {
  return api<void>(`/api/v1/lessons/${lessonId}`, {
    method: 'DELETE',
  });
}


export async function generateQuizLesson(body: {
  text?: string;
  word_ids?: number[];
  title?: string;
  source_lang?: string;
  target_lang?: string;
}): Promise<any> {
  return api('/api/v1/lessons/generate-quiz', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function completeLesson(
  lessonId: number,
  body: {
    is_completed?: boolean;
    score?: number;
    total?: number;
  } = { is_completed: true }
): Promise<any> {
  return api(`/api/v1/lessons/${lessonId}/complete`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function submitReviewRating(wordId: number, rating: string): Promise<any> {
  return api('/api/v1/review/submit', {
    method: 'POST',
    body: JSON.stringify({
      word_id: wordId,
      rating,
    }),
  });
}

export async function fetchProfiles(): Promise<LearningProfile[]> {
  return api<LearningProfile[]>('/api/v1/profiles/');
}

export async function createProfile(body: {
  source_language: string;
  target_language: string;
}): Promise<LearningProfile> {
  return api<LearningProfile>('/api/v1/profiles/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function switchProfile(profileId: number): Promise<LearningProfile> {
  return api<LearningProfile>(`/api/v1/profiles/${profileId}/switch`, {
    method: 'POST',
  });
}

