import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  listStores,
  selectStore,
  createFirstStore,
  acceptInvitation,
  getCapabilities,
} from './api';

const API_URL = 'http://localhost:4000';

describe('stores API client', () => {
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

  describe('listStores', () => {
    it('returns stores array on success', async () => {
      const stores = [{ id: 's1', name: 'Store A', timezone: 'Asia/Ho_Chi_Minh', currency: 'VND' }];
      mockFetch({ data: stores });
      const result = await listStores();
      expect(result).toEqual(stores);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores`,
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        }),
      );
    });

    it('returns empty array when no stores', async () => {
      mockFetch({ data: [] });
      const result = await listStores();
      expect(result).toEqual([]);
    });

    it('throws on 401', async () => {
      mockFetch({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required', requestId: 'r1' } }, 401);
      await expect(listStores()).rejects.toThrow('Authentication required');
    });
  });

  describe('selectStore', () => {
    it('returns store on success', async () => {
      const store = { id: 's1', name: 'Store A' };
      mockFetch({ data: store });
      const result = await selectStore('s1');
      expect(result).toEqual(store);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/s1/select`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({ 'x-csrf-token': 'test-csrf' }),
        }),
      );
    });

    it('throws 403 for inaccessible store', async () => {
      mockFetch({ error: { code: 'STORE_ACCESS_DENIED', message: 'Access denied', requestId: 'r2' } }, 403);
      await expect(selectStore('s2')).rejects.toThrow('Access denied');
    });
  });

  describe('createFirstStore', () => {
    it('returns store on success', async () => {
      const store = { id: 's1', name: 'My Store', timezone: 'Asia/Ho_Chi_Minh', currency: 'VND' };
      mockFetch({ data: store });
      const result = await createFirstStore({ name: 'My Store' });
      expect(result).toEqual(store);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            'x-csrf-token': 'test-csrf',
            'idempotency-key': expect.any(String),
          }),
          body: JSON.stringify({ name: 'My Store', timezone: undefined, currency: undefined }),
        }),
      );
    });

    it('includes optional timezone and currency', async () => {
      mockFetch({ data: { id: 's1' } });
      await createFirstStore({ name: 'My Store', timezone: 'UTC', currency: 'USD' });
      const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(call[1]?.body as string);
      expect(body).toEqual({ name: 'My Store', timezone: 'UTC', currency: 'USD' });
    });

    it('throws 403 for unverified user', async () => {
      mockFetch({ error: { code: 'FORBIDDEN', message: 'Email not verified', requestId: 'r3' } }, 403);
      await expect(createFirstStore({ name: 'My Store' })).rejects.toThrow('Email not verified');
    });
  });

  describe('acceptInvitation', () => {
    it('returns membership on success', async () => {
      const membership = { userId: 'u1', storeId: 's1', status: 'ACTIVE' };
      mockFetch({ data: membership });
      const result = await acceptInvitation('inv-token');
      expect(result).toEqual(membership);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/invitations/accept`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({ 'x-csrf-token': 'test-csrf' }),
          body: JSON.stringify({ token: 'inv-token' }),
        }),
      );
    });

    it('throws 400 for invalid token', async () => {
      mockFetch({ error: { code: 'VALIDATION_ERROR', message: 'Invitation token is required', requestId: 'r4' } }, 400);
      await expect(acceptInvitation('')).rejects.toThrow('Invitation token is required');
    });
  });

  describe('getCapabilities', () => {
    it('returns permissions array', async () => {
      mockFetch({ data: { permissions: ['stores.read', 'orders.read'] } });
      const result = await getCapabilities();
      expect(result).toEqual({ permissions: ['stores.read', 'orders.read'] });
    });

    it('returns empty permissions when unauthenticated', async () => {
      mockFetch({ data: { permissions: [] } });
      const result = await getCapabilities();
      expect(result).toEqual({ permissions: [] });
    });

    it('throws 401', async () => {
      mockFetch({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required', requestId: 'r5' } }, 401);
      await expect(getCapabilities()).rejects.toThrow('Authentication required');
    });
  });
});
