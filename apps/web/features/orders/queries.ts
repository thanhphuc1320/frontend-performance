'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from './api';
import type { OrderFilters } from './types';

export function useOrders(storeId: string, filters?: OrderFilters) {
  return useQuery({
    queryKey: ['orders', storeId, filters],
    queryFn: () => listOrders(storeId, filters),
  });
}

export function useOrder(storeId: string, orderId: string) {
  return useQuery({
    queryKey: ['order', storeId, orderId],
    queryFn: () => getOrder(storeId, orderId),
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ storeId, data }: { storeId: string; data: Parameters<typeof createOrder>[1] }) =>
      createOrder(storeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      storeId,
      orderId,
      data,
    }: {
      storeId: string;
      orderId: string;
      data: Parameters<typeof updateOrderStatus>[2];
    }) => updateOrderStatus(storeId, orderId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['order', variables.storeId, variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ storeId, orderId, notes }: { storeId: string; orderId: string; notes?: string | null }) =>
      cancelOrder(storeId, orderId, notes),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', variables.storeId, variables.orderId] });
    },
  });
}

export function useCustomers(storeId: string, search?: string) {
  return useQuery({
    queryKey: ['customers', storeId, search],
    queryFn: () => listCustomers(storeId, search),
  });
}

export function useCustomer(storeId: string, customerId: string) {
  return useQuery({
    queryKey: ['customer', storeId, customerId],
    queryFn: () => getCustomer(storeId, customerId),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ storeId, data }: { storeId: string; data: Parameters<typeof createCustomer>[1] }) =>
      createCustomer(storeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      storeId,
      customerId,
      data,
    }: {
      storeId: string;
      customerId: string;
      data: Parameters<typeof updateCustomer>[2];
    }) => updateCustomer(storeId, customerId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customer', variables.storeId, variables.customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ storeId, customerId }: { storeId: string; customerId: string }) =>
      deleteCustomer(storeId, customerId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', variables.storeId, variables.customerId] });
    },
  });
}
