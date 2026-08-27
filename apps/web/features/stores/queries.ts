'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listStores,
  selectStore,
  createFirstStore,
  acceptInvitation,
  getCapabilities,
} from './api';

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: listStores,
  });
}

export function useSelectStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: selectStore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['capabilities'] });
    },
  });
}

export function useCreateFirstStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createFirstStore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['capabilities'] });
    },
  });
}

export function useCapabilities() {
  return useQuery({
    queryKey: ['capabilities'],
    queryFn: getCapabilities,
  });
}
