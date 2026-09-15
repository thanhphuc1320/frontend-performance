'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  archiveProduct,
  duplicateProduct,
  getCategory,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listTags,
  createTag,
  deleteTag,
} from './api';
import type { ProductFilters } from './types';

export function useProducts(storeId: string, filters?: ProductFilters) {
  return useQuery({
    queryKey: ['products', storeId, filters],
    queryFn: () => listProducts(storeId, filters),
  });
}

export function useProduct(storeId: string, productId: string) {
  return useQuery({
    queryKey: ['product', storeId, productId],
    queryFn: () => getProduct(storeId, productId),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ storeId, data }: { storeId: string; data: Parameters<typeof createProduct>[1] }) =>
      createProduct(storeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      storeId,
      productId,
      data,
    }: {
      storeId: string;
      productId: string;
      data: Parameters<typeof updateProduct>[2];
    }) => updateProduct(storeId, productId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product', variables.storeId, variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useArchiveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ storeId, productId }: { storeId: string; productId: string }) =>
      archiveProduct(storeId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDuplicateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ storeId, productId }: { storeId: string; productId: string }) =>
      duplicateProduct(storeId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useCategory(storeId: string, categoryId: string) {
  return useQuery({
    queryKey: ['category', storeId, categoryId],
    queryFn: () => getCategory(storeId, categoryId),
  });
}

export function useCategories(storeId: string, tree?: boolean) {
  return useQuery({
    queryKey: ['categories', storeId],
    queryFn: () => listCategories(storeId, tree),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ storeId, data }: { storeId: string; data: Parameters<typeof createCategory>[1] }) =>
      createCategory(storeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      storeId,
      categoryId,
      data,
    }: {
      storeId: string;
      categoryId: string;
      data: Parameters<typeof updateCategory>[2];
    }) => updateCategory(storeId, categoryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ storeId, categoryId }: { storeId: string; categoryId: string }) =>
      deleteCategory(storeId, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useTags(storeId: string) {
  return useQuery({
    queryKey: ['tags', storeId],
    queryFn: () => listTags(storeId),
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ storeId, data }: { storeId: string; data: Parameters<typeof createTag>[1] }) =>
      createTag(storeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ storeId, tagId }: { storeId: string; tagId: string }) => deleteTag(storeId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}
