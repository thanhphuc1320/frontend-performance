import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useStores,
  useSelectStore,
  useCreateFirstStore,
  useAcceptInvitation,
  useCapabilities,
} from './queries';
import * as api from './api';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('stores queries', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useStores', () => {
    it('returns stores list', async () => {
      vi.spyOn(api, 'listStores').mockResolvedValueOnce([{ id: 's1', name: 'Store A' }]);
      const { result } = renderHook(() => useStores(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([{ id: 's1', name: 'Store A' }]);
    });

    it('returns empty array', async () => {
      vi.spyOn(api, 'listStores').mockResolvedValueOnce([]);
      const { result } = renderHook(() => useStores(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    it('exposes 401 error', async () => {
      vi.spyOn(api, 'listStores').mockRejectedValueOnce(new api.ApiError(401, 'UNAUTHENTICATED', 'Authentication required'));
      const { result } = renderHook(() => useStores(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect((result.current.error as api.ApiError).status).toBe(401);
    });
  });

  describe('useSelectStore', () => {
    it('mutates and invalidates stores and capabilities', async () => {
      vi.spyOn(api, 'selectStore').mockResolvedValueOnce({ id: 's1', name: 'Store A' });
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useSelectStore(), { wrapper: Wrapper });
      result.current.mutate('s1');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['stores'] });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['capabilities'] });
    });
  });

  describe('useCreateFirstStore', () => {
    it('mutates and returns store', async () => {
      vi.spyOn(api, 'createFirstStore').mockResolvedValueOnce({ id: 's1', name: 'My Store' });
      const { result } = renderHook(() => useCreateFirstStore(), { wrapper: createWrapper() });
      result.current.mutate({ name: 'My Store' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ id: 's1', name: 'My Store' });
    });

    it('exposes 403 error', async () => {
      vi.spyOn(api, 'createFirstStore').mockRejectedValueOnce(new api.ApiError(403, 'FORBIDDEN', 'Email not verified'));
      const { result } = renderHook(() => useCreateFirstStore(), { wrapper: createWrapper() });
      result.current.mutate({ name: 'My Store' });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect((result.current.error as api.ApiError).status).toBe(403);
    });
  });

  describe('useAcceptInvitation', () => {
    it('mutates and returns membership', async () => {
      vi.spyOn(api, 'acceptInvitation').mockResolvedValueOnce({ userId: 'u1', storeId: 's1', status: 'ACTIVE' });
      const { result } = renderHook(() => useAcceptInvitation(), { wrapper: createWrapper() });
      result.current.mutate('token123');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ userId: 'u1', storeId: 's1', status: 'ACTIVE' });
    });
  });

  describe('useCapabilities', () => {
    it('returns permissions', async () => {
      vi.spyOn(api, 'getCapabilities').mockResolvedValueOnce({ permissions: ['stores.read'] });
      const { result } = renderHook(() => useCapabilities(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ permissions: ['stores.read'] });
    });

    it('exposes 403 as access denied', async () => {
      vi.spyOn(api, 'getCapabilities').mockRejectedValueOnce(new api.ApiError(403, 'STORE_ACCESS_DENIED', 'Access denied'));
      const { result } = renderHook(() => useCapabilities(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect((result.current.error as api.ApiError).code).toBe('STORE_ACCESS_DENIED');
    });
  });
});
