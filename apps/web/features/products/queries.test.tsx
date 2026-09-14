import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useProducts,
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  useArchiveProduct,
  useDuplicateProduct,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useTags,
  useCreateTag,
  useDeleteTag,
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

describe('products queries', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useProducts', () => {
    it('fetches and returns paginated products', async () => {
      const mockData = {
        items: [{ id: 'p1', name: 'Product A' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      vi.spyOn(api, 'listProducts').mockResolvedValueOnce(mockData as unknown as Awaited<ReturnType<typeof api.listProducts>>);
      const { result } = renderHook(() => useProducts('s1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });

    it('caches results with filters in query key', async () => {
      const mockData1 = {
        items: [{ id: 'p1', name: 'Product A' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      const mockData2 = {
        items: [{ id: 'p2', name: 'Product B' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      vi.spyOn(api, 'listProducts')
        .mockResolvedValueOnce(mockData1 as unknown as Awaited<ReturnType<typeof api.listProducts>>)
        .mockResolvedValueOnce(mockData2 as unknown as Awaited<ReturnType<typeof api.listProducts>>);

      const { result: result1 } = renderHook(() => useProducts('s1', { status: 'ACTIVE' }), { wrapper: createWrapper() });
      const { result: result2 } = renderHook(() => useProducts('s1', { status: 'DRAFT' }), { wrapper: createWrapper() });

      await waitFor(() => expect(result1.current.isSuccess).toBe(true));
      await waitFor(() => expect(result2.current.isSuccess).toBe(true));

      expect(result1.current.data).toEqual(mockData1);
      expect(result2.current.data).toEqual(mockData2);
    });

    it('exposes 401 error', async () => {
      vi.spyOn(api, 'listProducts').mockRejectedValueOnce(new api.ApiError(401, 'UNAUTHENTICATED', 'Authentication required'));
      const { result } = renderHook(() => useProducts('s1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect((result.current.error as api.ApiError).status).toBe(401);
    });
  });

  describe('useProduct', () => {
    it('fetches and returns product detail', async () => {
      const mockData = {
        product: { id: 'p1', name: 'Product A' },
        variants: [],
        categories: [],
        tags: [],
        images: [],
      };
      vi.spyOn(api, 'getProduct').mockResolvedValueOnce(mockData as unknown as Awaited<ReturnType<typeof api.getProduct>>);
      const { result } = renderHook(() => useProduct('s1', 'p1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useCreateProduct', () => {
    it('mutates and returns created product', async () => {
      const mockProduct = { id: 'p1', name: 'New Product' };
      vi.spyOn(api, 'createProduct').mockResolvedValueOnce(mockProduct as unknown as Awaited<ReturnType<typeof api.createProduct>>);
      const { result } = renderHook(() => useCreateProduct(), { wrapper: createWrapper() });
      result.current.mutate({ storeId: 's1', data: { name: 'New Product' } });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockProduct);
    });

    it('invalidates products cache on success', async () => {
      vi.spyOn(api, 'createProduct').mockResolvedValueOnce({ id: 'p1' } as unknown as Awaited<ReturnType<typeof api.createProduct>>);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useCreateProduct(), { wrapper: Wrapper });
      result.current.mutate({ storeId: 's1', data: { name: 'New Product' } });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['products'] });
    });
  });

  describe('useUpdateProduct', () => {
    it('mutates and returns updated product', async () => {
      const mockProduct = { id: 'p1', name: 'Updated Product' };
      vi.spyOn(api, 'updateProduct').mockResolvedValueOnce(mockProduct as unknown as Awaited<ReturnType<typeof api.updateProduct>>);
      const { result } = renderHook(() => useUpdateProduct(), { wrapper: createWrapper() });
      result.current.mutate({ storeId: 's1', productId: 'p1', data: { name: 'Updated Product' } });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockProduct);
    });

    it('invalidates product and products cache on success', async () => {
      vi.spyOn(api, 'updateProduct').mockResolvedValueOnce({ id: 'p1' } as unknown as Awaited<ReturnType<typeof api.updateProduct>>);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useUpdateProduct(), { wrapper: Wrapper });
      result.current.mutate({ storeId: 's1', productId: 'p1', data: { name: 'Updated Product' } });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['product', 's1', 'p1'] });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['products'] });
    });
  });

  describe('useArchiveProduct', () => {
    it('mutates and invalidates products cache', async () => {
      vi.spyOn(api, 'archiveProduct').mockResolvedValueOnce(undefined);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useArchiveProduct(), { wrapper: Wrapper });
      result.current.mutate({ storeId: 's1', productId: 'p1' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['products'] });
    });
  });

  describe('useDuplicateProduct', () => {
    it('mutates and invalidates products cache', async () => {
      vi.spyOn(api, 'duplicateProduct').mockResolvedValueOnce({ id: 'p2' } as unknown as Awaited<ReturnType<typeof api.duplicateProduct>>);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useDuplicateProduct(), { wrapper: Wrapper });
      result.current.mutate({ storeId: 's1', productId: 'p1' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['products'] });
    });
  });

  describe('useCategories', () => {
    it('fetches and returns categories', async () => {
      const mockData = [{ id: 'c1', name: 'Category A' }];
      vi.spyOn(api, 'listCategories').mockResolvedValueOnce(mockData as unknown as Awaited<ReturnType<typeof api.listCategories>>);
      const { result } = renderHook(() => useCategories('s1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });

    it('passes tree parameter to api', async () => {
      const mockData = [{ id: 'c1', name: 'Category A', children: [] }];
      const spy = vi.spyOn(api, 'listCategories').mockResolvedValueOnce(mockData as unknown as Awaited<ReturnType<typeof api.listCategories>>);
      const { result } = renderHook(() => useCategories('s1', true), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(spy).toHaveBeenCalledWith('s1', true);
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useCreateCategory', () => {
    it('mutates and invalidates categories cache', async () => {
      vi.spyOn(api, 'createCategory').mockResolvedValueOnce({ id: 'c1' } as unknown as Awaited<ReturnType<typeof api.createCategory>>);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useCreateCategory(), { wrapper: Wrapper });
      result.current.mutate({ storeId: 's1', data: { name: 'New Category' } });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['categories'] });
    });
  });

  describe('useDeleteCategory', () => {
    it('mutates and invalidates categories cache', async () => {
      vi.spyOn(api, 'deleteCategory').mockResolvedValueOnce(undefined);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useDeleteCategory(), { wrapper: Wrapper });
      result.current.mutate({ storeId: 's1', categoryId: 'c1' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['categories'] });
    });
  });

  describe('useTags', () => {
    it('fetches and returns tags', async () => {
      const mockData = [{ id: 't1', name: 'Tag A' }];
      vi.spyOn(api, 'listTags').mockResolvedValueOnce(mockData as unknown as Awaited<ReturnType<typeof api.listTags>>);
      const { result } = renderHook(() => useTags('s1'), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useCreateTag', () => {
    it('mutates and invalidates tags cache', async () => {
      vi.spyOn(api, 'createTag').mockResolvedValueOnce({ id: 't1' } as unknown as Awaited<ReturnType<typeof api.createTag>>);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useCreateTag(), { wrapper: Wrapper });
      result.current.mutate({ storeId: 's1', data: { name: 'New Tag' } });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['tags'] });
    });
  });

  describe('useDeleteTag', () => {
    it('mutates and invalidates tags cache', async () => {
      vi.spyOn(api, 'deleteTag').mockResolvedValueOnce(undefined);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      const Wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
      const { result } = renderHook(() => useDeleteTag(), { wrapper: Wrapper });
      result.current.mutate({ storeId: 's1', tagId: 't1' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['tags'] });
    });
  });
});
