const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.split('; ').find((c) => c.startsWith('csrf_token='));
  return match ? match.split('=')[1] ?? '' : '';
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit & { skipCsrf?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body ? { 'content-type': 'application/json' } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  // Add session token from localStorage if available
  const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  if (sessionToken) {
    headers['x-session-token'] = sessionToken;
  }

  if (!options.skipCsrf) {
    headers['x-csrf-token'] = getCsrfToken();
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  const payload = await res.json().catch(() => ({})) as unknown;

  if (!res.ok) {
    const error = (payload as { error?: { code: string; message: string } } | undefined)?.error;
    throw new ApiError(
      res.status,
      error?.code ?? 'REQUEST_ERROR',
      error?.message ?? 'Request failed',
    );
  }

  return (payload as { data: T }).data;
}

export function register(body: { email: string; password: string }): Promise<{ accepted: true }> {
  return apiFetch('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(body) });
}

export function verifyEmail(token: string): Promise<{ verified: boolean }> {
  return apiFetch('/api/v1/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
}

export function login(body: { email: string; password: string; rememberMe?: boolean }): Promise<{ userId: string; sessionToken?: string }> {
  return apiFetch('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(body) });
}

export function logout(): Promise<{ accepted: true }> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('session_token');
  }
  return apiFetch('/api/v1/auth/logout', { method: 'POST' });
}

export function requestPasswordReset(email: string): Promise<{ accepted: true }> {
  return apiFetch('/api/v1/auth/password-reset-request', { method: 'POST', body: JSON.stringify({ email }) });
}

export function resetPassword(body: { token: string; password: string }): Promise<{ accepted: boolean }> {
  return apiFetch('/api/v1/auth/password-reset', { method: 'POST', body: JSON.stringify(body) });
}

export function requestEmailChange(newEmail: string): Promise<{ accepted: true }> {
  return apiFetch('/api/v1/auth/email-change-request', { method: 'POST', body: JSON.stringify({ newEmail }) });
}

export function verifyEmailChange(token: string): Promise<{ accepted: boolean }> {
  return apiFetch('/api/v1/auth/email-change', { method: 'POST', body: JSON.stringify({ token }) });
}

export function getSession(): Promise<{ userId?: string }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  return apiFetch('/api/v1/auth/session', {
    method: 'GET',
    skipCsrf: true,
    headers: token ? { 'x-session-token': token } : {},
  });
}
