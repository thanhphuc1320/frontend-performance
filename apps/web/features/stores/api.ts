import { ApiError } from '../auth/api';
export { ApiError };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.split('; ').find((c) => c.startsWith('csrf_token='));
  return match ? match.split('=')[1] ?? '' : '';
}

async function apiFetch<T>(
  path: string,
  options: RequestInit & { skipCsrf?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body ? { 'content-type': 'application/json' } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

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

export interface Store {
  id: string;
  name: string;
  timezone?: string;
  currency?: string;
}

export function listStores(): Promise<Store[]> {
  return apiFetch('/api/v1/stores', { method: 'GET', skipCsrf: true });
}

export function selectStore(storeId: string): Promise<Store> {
  return apiFetch(`/api/v1/stores/${storeId}/select`, { method: 'POST' });
}

export function createFirstStore(body: { name: string; timezone?: string; currency?: string }): Promise<Store> {
  return apiFetch('/api/v1/stores', {
    method: 'POST',
    headers: { 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify(body),
  });
}

export interface Membership {
  userId: string;
  storeId: string;
  status: string;
}

export function acceptInvitation(token: string): Promise<Membership> {
  return apiFetch('/api/v1/invitations/accept', { method: 'POST', body: JSON.stringify({ token }) });
}

export interface Capabilities {
  permissions: string[];
}

export function getCapabilities(): Promise<Capabilities> {
  return apiFetch('/api/v1/capabilities', { method: 'GET', skipCsrf: true });
}
