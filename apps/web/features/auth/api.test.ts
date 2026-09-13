import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  register,
  verifyEmail,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  requestEmailChange,
  verifyEmailChange,
  getSession,
} from './api';

const API_URL = 'http://localhost:4000';

describe('auth API client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'csrf_token=test-csrf',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetch(response: unknown, status = 200) {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
    } as Response);
  }

  describe('register', () => {
    it('returns accepted on success', async () => {
      mockFetch({ data: { accepted: true } });
      const result = await register({ email: 'a@b.com', password: 'Password1!' });
      expect(result).toEqual({ accepted: true });
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/auth/register`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            'x-csrf-token': 'test-csrf',
          }),
          credentials: 'include',
          body: JSON.stringify({ email: 'a@b.com', password: 'Password1!' }),
        }),
      );
    });

    it('throws on validation error', async () => {
      mockFetch({ error: { code: 'VALIDATION_ERROR', message: 'Invalid email', requestId: 'r1' } }, 400);
      await expect(register({ email: 'bad', password: 'short' })).rejects.toThrow('Invalid email');
    });

    it('throws on network error', async () => {
      (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network failed'));
      await expect(register({ email: 'a@b.com', password: 'Password1!' })).rejects.toThrow('Network failed');
    });
  });

  describe('verifyEmail', () => {
    it('returns verified on success', async () => {
      mockFetch({ data: { verified: true } });
      const result = await verifyEmail('token123');
      expect(result).toEqual({ verified: true });
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/auth/verify-email`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({ 'x-csrf-token': 'test-csrf' }),
          body: JSON.stringify({ token: 'token123' }),
        }),
      );
    });

    it('throws on expired token', async () => {
      mockFetch({ error: { code: 'TOKEN_EXPIRED', message: 'Token expired', requestId: 'r2' } }, 400);
      await expect(verifyEmail('old')).rejects.toThrow('Token expired');
    });
  });

  describe('login', () => {
    it('returns userId on success', async () => {
      mockFetch({ data: { userId: 'u1' } });
      const result = await login({ email: 'a@b.com', password: 'Password1!' });
      expect(result).toEqual({ userId: 'u1' });
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/auth/login`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({ 'x-csrf-token': 'test-csrf' }),
        }),
      );
    });

    it('throws 401 for invalid credentials', async () => {
      mockFetch({ error: { code: 'UNAUTHENTICATED', message: 'Invalid credentials', requestId: 'r3' } }, 401);
      await expect(login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow('Invalid credentials');
    });

    it('throws 429 for rate limit', async () => {
      mockFetch({ error: { code: 'RATE_LIMITED', message: 'Too many failed attempts', requestId: 'r4' } }, 429);
      await expect(login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow('Too many failed attempts');
    });
  });

  describe('logout', () => {
    it('returns accepted on success', async () => {
      mockFetch({ data: { accepted: true } });
      const result = await logout();
      expect(result).toEqual({ accepted: true });
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/auth/logout`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({ 'x-csrf-token': 'test-csrf' }),
        }),
      );
    });
  });

  describe('requestPasswordReset', () => {
    it('returns accepted on success', async () => {
      mockFetch({ data: { accepted: true } });
      const result = await requestPasswordReset('a@b.com');
      expect(result).toEqual({ accepted: true });
    });

    it('returns accepted for unknown email (no enumeration)', async () => {
      mockFetch({ data: { accepted: true } });
      const result = await requestPasswordReset('unknown@b.com');
      expect(result).toEqual({ accepted: true });
    });
  });

  describe('resetPassword', () => {
    it('returns accepted on success', async () => {
      mockFetch({ data: { accepted: true } });
      const result = await resetPassword({ token: 't1', password: 'NewPassword1!' });
      expect(result).toEqual({ accepted: true });
    });

    it('throws on invalid token', async () => {
      mockFetch({ error: { code: 'TOKEN_INVALID', message: 'Invalid token', requestId: 'r5' } }, 400);
      await expect(resetPassword({ token: 'bad', password: 'NewPassword1!' })).rejects.toThrow('Invalid token');
    });
  });

  describe('requestEmailChange', () => {
    it('returns accepted on success', async () => {
      mockFetch({ data: { accepted: true } });
      const result = await requestEmailChange('new@b.com');
      expect(result).toEqual({ accepted: true });
    });

    it('throws 401 when unauthenticated', async () => {
      mockFetch({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required', requestId: 'r6' } }, 401);
      await expect(requestEmailChange('new@b.com')).rejects.toThrow('Authentication required');
    });
  });

  describe('verifyEmailChange', () => {
    it('returns accepted on success', async () => {
      mockFetch({ data: { accepted: true } });
      const result = await verifyEmailChange('token123');
      expect(result).toEqual({ accepted: true });
    });
  });

  describe('getSession', () => {
    it('returns userId when authenticated', async () => {
      mockFetch({ data: { userId: 'u1' } });
      const result = await getSession();
      expect(result).toEqual({ userId: 'u1' });
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/auth/session`,
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
    });

    it('returns empty object when unauthenticated', async () => {
      mockFetch({ data: {} });
      const result = await getSession();
      expect(result).toEqual({});
    });

    it('does not include csrf header for GET', async () => {
      mockFetch({ data: {} });
      await getSession();
      const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(call[1]?.headers).not.toHaveProperty('x-csrf-token');
    });
  });

  describe('CSRF handling', () => {
    it('reads csrf_token from cookie for mutations', async () => {
      document.cookie = 'csrf_token=abc123';
      mockFetch({ data: { accepted: true } });
      await logout();
      const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      const headers = call[1]?.headers as Record<string, string>;
      expect(headers['x-csrf-token']).toBe('abc123');
    });

    it('sends empty csrf header when cookie missing', async () => {
      document.cookie = '';
      mockFetch({ data: { accepted: true } });
      await logout();
      const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      const headers = call[1]?.headers as Record<string, string>;
      expect(headers['x-csrf-token']).toBe('');
    });
  });
});
