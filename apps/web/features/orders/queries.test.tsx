import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useOrders,
  useOrder,
  useCreateOrder,
  useUpdateOrderStatus,
  useCancelOrder,
  useCustomers,
  useCustomer,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
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

describe('orders queries', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useOrders', () => {
    it('fetches and returns paginated orders', async () => {
      const mockData = {
        items: [{ id: 'o1', orderNumber: 'ORD-001' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      vi.spyOn(api, 'listOrders').mockResolvedValueOnce(mockData as unknown as Awaited<ReturnType<typeof api.listOrders>>);
      const { result } = renderHook(() => useOrders('s1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });

    it('caches results with filters in query key', async () => {
      const mockData1 = {
        items: [{ id: 'o1', orderNumber: 'ORD-001' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      const mockData2 = {
        items: [{ id: 'o2', orderNumber: 'ORD-002' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      vi.spyOn(api, 'listOrders')
        .mockResolvedValueOnce(mockData1 as unknown as Awaited<ReturnType<typeof api.listOrders>>)
        .mockResolvedValueOnce(mockData2 as unknown as Awaited<ReturnType<typeof api.listOrders>>);

      const { result: result1 } = renderHook(() => useOrders('s1', { status: 'PENDING' }), { wrapper: createWrapper() });
      const { result: result2 } = renderHook(() => useOrders('s1', { status: 'CONFIRMED' }), { wrapper: createWrapper() });

      await waitFor(() => expect(result1.current.isSuccess).toBe(true));
      await waitFor(() => expect(result2.current.isSuccess).toBe(true));

      expect(result1.current.data).toEqual(mockData1);
      expect(result2.current.data).toEqual(mockData2);
    });

    it('exposes 401 error', async () => {
      vi.spyOn(api, 'listOrders').mockRejectedValueOnce(new api.ApiError(401, 'UNAUTHENTICATED', 'Authentication required'));
      const { result } = renderHook(() => useOrders('s1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect((result.current.error as api.ApiError).status).toBe(401);
    });
  });

  describe('useOrder', () => {
    it('fetches and returns order detail', async () => {
      const mockData = {
        order: { id: 'o1', orderNumber: 'ORD-001' },
        customer: { id: 'c1', name: 'Customer A' },
        items: [],
        statusHistory: [],
      };
      vi.spyOn(api, 'getOrder').mockResolvedValueOnce(mockData as unknown as Awaited<ReturnType<typeof api.getOrder>>);
      const { result } = renderHook(() => useOrder('s1', 'o1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useCreateOrder', () => {
    it('mutates and returns created order', async () => {
      const mockOrder = { id: 'o1', orderNumber: 'ORD-001' };
      vi.spyOn(api, 'createOrder').mockResolvedValueOnce(mockOrder as unknown as Awaited<ReturnType<typeof api.createOrder>>);
      const { result } = renderHook(() => useCreateOrder(), { wrapper: createWrapper() });
      result.current.mutate({
        storeId: 's1',
        data: { customerId: 'c1', totalAmount: 100, shippingFee: 10, discountAmount: 0, finalAmount: 110, items: [] },
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockOrder);
    });

    it('invalidates orders cache on success', async () => {
      vi.spyOn(api, 'createOrder').mockResolvedValueOnce({ id: 'o1' } as unknown as Awaited<ReturnType<typeof api.createOrder>>);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useCreateOrder(), { wrapper: Wrapper });
      result.current.mutate({
        storeId: 's1',
        data: { customerId: 'c1', totalAmount: 100, shippingFee: 10, discountAmount: 0, finalAmount: 110, items: [] },
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
    });
  });

  describe('useUpdateOrderStatus', () => {
    it('mutates and returns updated order', async () => {
      const mockOrder = { id: 'o1', status: 'CONFIRMED' };
      vi.spyOn(api, 'updateOrderStatus').mockResolvedValueOnce(mockOrder as unknown as Awaited<ReturnType<typeof api.updateOrderStatus>>);
      const { result } = renderHook(() => useUpdateOrderStatus(), { wrapper: createWrapper() });
      result.current.mutate({ storeId: 's1', orderId: 'o1', data: { status: 'CONFIRMED' } });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockOrder);
    });

    it('invalidates order and orders cache on success', async () => {
      vi.spyOn(api, 'updateOrderStatus').mockResolvedValueOnce({ id: 'o1' } as unknown as Awaited<ReturnType<typeof api.updateOrderStatus>>);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useUpdateOrderStatus(), { wrapper: Wrapper });
      result.current.mutate({ storeId: 's1', orderId: 'o1', data: { status: 'CONFIRMED' } });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['order', 's1', 'o1'] });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
    });
  });

  describe('useCancelOrder', () => {
    it('mutates and returns void', async () => {
      vi.spyOn(api, 'cancelOrder').mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useCancelOrder(), { wrapper: createWrapper() });
      result.current.mutate({ storeId: 's1', orderId: 'o1' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeUndefined();
    });

    it('invalidates orders and order cache on success', async () => {
      vi.spyOn(api, 'cancelOrder').mockResolvedValueOnce(undefined);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useCancelOrder(), { wrapper: Wrapper });
      result.current.mutate({ storeId: 's1', orderId: 'o1' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['order', 's1', 'o1'] });
    });
  });

  describe('useCustomers', () => {
    it('fetches and returns customers', async () => {
      const mockData = [{ id: 'c1', name: 'Customer A' }];
      vi.spyOn(api, 'listCustomers').mockResolvedValueOnce(mockData as unknown as Awaited<ReturnType<typeof api.listCustomers>>);
      const { result } = renderHook(() => useCustomers('s1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });

    it('passes search parameter to api', async () => {
      const mockData = [{ id: 'c1', name: 'Customer A' }];
      const spy = vi.spyOn(api, 'listCustomers').mockResolvedValueOnce(mockData as unknown as Awaited<ReturnType<typeof api.listCustomers>>);
      const { result } = renderHook(() => useCustomers('s1', 'john'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(spy).toHaveBeenCalledWith('s1', 'john');
      expect(result.current.data).toEqual(mockData);
    });

    it('exposes 401 error', async () => {
      vi.spyOn(api, 'listCustomers').mockRejectedValueOnce(new api.ApiError(401, 'UNAUTHENTICATED', 'Authentication required'));
      const { result } = renderHook(() => useCustomers('s1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect((result.current.error as api.ApiError).status).toBe(401);
    });
  });

  describe('useCustomer', () => {
    it('fetches and returns customer with orders', async () => {
      const mockData = {
        customer: { id: 'c1', name: 'Customer A' },
        recentOrders: [{ id: 'o1', orderNumber: 'ORD-001' }],
      };
      vi.spyOn(api, 'getCustomer').mockResolvedValueOnce(mockData as unknown as Awaited<ReturnType<typeof api.getCustomer>>);
      const { result } = renderHook(() => useCustomer('s1', 'c1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useCreateCustomer', () => {
    it('mutates and returns created customer', async () => {
      const mockCustomer = { id: 'c1', name: 'New Customer' };
      vi.spyOn(api, 'createCustomer').mockResolvedValueOnce(mockCustomer as unknown as Awaited<ReturnType<typeof api.createCustomer>>);
      const { result } = renderHook(() => useCreateCustomer(), { wrapper: createWrapper() });
      result.current.mutate({ storeId: 's1', data: { name: 'New Customer', phone: '0901234567' } });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockCustomer);
    });

    it('invalidates customers cache on success', async () => {
      vi.spyOn(api, 'createCustomer').mockResolvedValueOnce({ id: 'c1' } as unknown as Awaited<ReturnType<typeof api.createCustomer>>);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useCreateCustomer(), { wrapper: Wrapper });
      result.current.mutate({ storeId: 's1', data: { name: 'New Customer', phone: '0901234567' } });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['customers'] });
    });
  });

  describe('useUpdateCustomer', () => {
    it('mutates and returns updated customer', async () => {
      const mockCustomer = { id: 'c1', name: 'Updated Customer' };
      vi.spyOn(api, 'updateCustomer').mockResolvedValueOnce(mockCustomer as unknown as Awaited<ReturnType<typeof api.updateCustomer>>);
      const { result } = renderHook(() => useUpdateCustomer(), { wrapper: createWrapper() });
      result.current.mutate({ storeId: 's1', customerId: 'c1', data: { name: 'Updated Customer' } });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockCustomer);
    });

    it('invalidates customer and customers cache on success', async () => {
      vi.spyOn(api, 'updateCustomer').mockResolvedValueOnce({ id: 'c1' } as unknown as Awaited<ReturnType<typeof api.updateCustomer>>);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useUpdateCustomer(), { wrapper: Wrapper });
      result.current.mutate({ storeId: 's1', customerId: 'c1', data: { name: 'Updated Customer' } });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['customer', 's1', 'c1'] });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['customers'] });
    });
  });

  describe('useDeleteCustomer', () => {
    it('mutates and returns void', async () => {
      vi.spyOn(api, 'deleteCustomer').mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useDeleteCustomer(), { wrapper: createWrapper() });
      result.current.mutate({ storeId: 's1', customerId: 'c1' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeUndefined();
    });

    it('invalidates customers and customer cache on success', async () => {
      vi.spyOn(api, 'deleteCustomer').mockResolvedValueOnce(undefined);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useDeleteCustomer(), { wrapper: Wrapper });
      result.current.mutate({ storeId: 's1', customerId: 'c1' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['customers'] });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['customer', 's1', 'c1'] });
    });
  });
});
