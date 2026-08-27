import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useRegister,
  useVerifyEmail,
  useLogin,
  useLogout,
  useRequestPasswordReset,
  useResetPassword,
  useRequestEmailChange,
  useVerifyEmailChange,
  useSession,
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

describe('auth queries', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useSession', () => {
    it('returns session data', async () => {
      vi.spyOn(api, 'getSession').mockResolvedValueOnce({ userId: 'u1' });
      const { result } = renderHook(() => useSession(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ userId: 'u1' });
    });

    it('returns empty object when unauthenticated', async () => {
      vi.spyOn(api, 'getSession').mockResolvedValueOnce({});
      const { result } = renderHook(() => useSession(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({});
    });
  });

  describe('useRegister', () => {
    it('mutates and returns accepted', async () => {
      vi.spyOn(api, 'register').mockResolvedValueOnce({ accepted: true });
      const { result } = renderHook(() => useRegister(), { wrapper: createWrapper() });
      result.current.mutate({ email: 'a@b.com', password: 'Password1!' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ accepted: true });
    });

    it('exposes error on failure', async () => {
      vi.spyOn(api, 'register').mockRejectedValueOnce(new api.ApiError(400, 'VALIDATION_ERROR', 'Invalid email'));
      const { result } = renderHook(() => useRegister(), { wrapper: createWrapper() });
      result.current.mutate({ email: 'bad', password: 'short' });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(api.ApiError);
    });
  });

  describe('useVerifyEmail', () => {
    it('mutates and returns verified', async () => {
      vi.spyOn(api, 'verifyEmail').mockResolvedValueOnce({ verified: true });
      const { result } = renderHook(() => useVerifyEmail(), { wrapper: createWrapper() });
      result.current.mutate('token123');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ verified: true });
    });
  });

  describe('useLogin', () => {
    it('mutates and returns userId', async () => {
      vi.spyOn(api, 'login').mockResolvedValueOnce({ userId: 'u1' });
      const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });
      result.current.mutate({ email: 'a@b.com', password: 'Password1!' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ userId: 'u1' });
    });

    it('exposes 401 error', async () => {
      vi.spyOn(api, 'login').mockRejectedValueOnce(new api.ApiError(401, 'UNAUTHENTICATED', 'Invalid credentials'));
      const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() });
      result.current.mutate({ email: 'a@b.com', password: 'wrong' });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect((result.current.error as api.ApiError).status).toBe(401);
    });
  });

  describe('useLogout', () => {
    it('mutates and invalidates session', async () => {
      vi.spyOn(api, 'logout').mockResolvedValueOnce({ accepted: true });
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });
      result.current.mutate();
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['session'] });
    });
  });

  describe('useRequestPasswordReset', () => {
    it('mutates and returns accepted', async () => {
      vi.spyOn(api, 'requestPasswordReset').mockResolvedValueOnce({ accepted: true });
      const { result } = renderHook(() => useRequestPasswordReset(), { wrapper: createWrapper() });
      result.current.mutate('a@b.com');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ accepted: true });
    });
  });

  describe('useResetPassword', () => {
    it('mutates and returns accepted', async () => {
      vi.spyOn(api, 'resetPassword').mockResolvedValueOnce({ accepted: true });
      const { result } = renderHook(() => useResetPassword(), { wrapper: createWrapper() });
      result.current.mutate({ token: 't1', password: 'NewPassword1!' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ accepted: true });
    });
  });

  describe('useRequestEmailChange', () => {
    it('mutates and returns accepted', async () => {
      vi.spyOn(api, 'requestEmailChange').mockResolvedValueOnce({ accepted: true });
      const { result } = renderHook(() => useRequestEmailChange(), { wrapper: createWrapper() });
      result.current.mutate('new@b.com');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ accepted: true });
    });
  });

  describe('useVerifyEmailChange', () => {
    it('mutates and returns accepted', async () => {
      vi.spyOn(api, 'verifyEmailChange').mockResolvedValueOnce({ accepted: true });
      const { result } = renderHook(() => useVerifyEmailChange(), { wrapper: createWrapper() });
      result.current.mutate('token123');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ accepted: true });
    });
  });
});
