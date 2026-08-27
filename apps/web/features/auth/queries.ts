'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: getSession,
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: register,
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: verifyEmail,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['capabilities'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['capabilities'] });
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: requestPasswordReset,
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: resetPassword,
  });
}

export function useRequestEmailChange() {
  return useMutation({
    mutationFn: requestEmailChange,
  });
}

export function useVerifyEmailChange() {
  return useMutation({
    mutationFn: verifyEmailChange,
  });
}
