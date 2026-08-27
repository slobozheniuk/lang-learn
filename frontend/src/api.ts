import { AuthResponse, DueReviewItem, Language, RegisterResponse, User, Word } from './types';

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
  email: string;
  password: string;
  default_source_lang?: string;
  default_target_lang?: string;
}): Promise<RegisterResponse> {
  return api<RegisterResponse>('/api/v1/auth/register', {
    method: 'POST',
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

export async function fetchDueReviews(): Promise<DueReviewItem[]> {
  return api<DueReviewItem[]>('/api/v1/review/due');
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

export async function deleteWord(wordId: number): Promise<void> {
  return api<void>(`/api/v1/words/${wordId}`, {
    method: 'DELETE',
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
