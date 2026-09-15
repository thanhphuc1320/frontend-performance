import { ApiError } from '../auth/api';
export { ApiError };
import type {
  Product,
  ProductDetail,
  PaginatedProducts,
  ProductFilters,
  Category,
  ProductTag,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.split('; ').find((c) => c.startsWith('csrf_token='));
  return match ? match.split('=')[1] ?? '' : '';
}

async function apiFetch<T>(
  path: string,
  options: RequestInit & { skipCsrf?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body ? { 'content-type': 'application/json' } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!options.skipCsrf) {
    headers['x-csrf-token'] = getCsrfToken();
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  const payload = await res.json().catch(() => ({})) as unknown;

  if (!res.ok) {
    const error = (payload as { error?: { code: string; message: string } } | undefined)?.error;
    throw new ApiError(
      res.status,
      error?.code ?? 'REQUEST_ERROR',
      error?.message ?? 'Request failed',
    );
  }

  return (payload as { data: T }).data;
}

export function listProducts(storeId: string, filters?: ProductFilters): Promise<PaginatedProducts> {
  const query = filters ? '?' + new URLSearchParams(
    Object.entries(filters)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString() : '';
  return apiFetch(`/api/v1/stores/${storeId}/products${query}`, { method: 'GET', skipCsrf: true });
}

export function getProduct(storeId: string, productId: string): Promise<ProductDetail> {
  return apiFetch(`/api/v1/stores/${storeId}/products/${productId}`, { method: 'GET', skipCsrf: true });
}

export function createProduct(storeId: string, data: Partial<Product>): Promise<Product> {
  return apiFetch(`/api/v1/stores/${storeId}/products`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateProduct(storeId: string, productId: string, data: Partial<Product>): Promise<Product> {
  return apiFetch(`/api/v1/stores/${storeId}/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function archiveProduct(storeId: string, productId: string): Promise<void> {
  return apiFetch(`/api/v1/stores/${storeId}/products/${productId}`, { method: 'DELETE' });
}

export function duplicateProduct(storeId: string, productId: string): Promise<Product> {
  return apiFetch(`/api/v1/stores/${storeId}/products/${productId}/duplicate`, { method: 'POST' });
}

export function getCategory(storeId: string, categoryId: string): Promise<Category> {
  return apiFetch(`/api/v1/stores/${storeId}/categories/${categoryId}`, { method: 'GET', skipCsrf: true });
}

export function listCategories(storeId: string, tree?: boolean): Promise<Category[]> {
  const query = tree !== undefined ? `?tree=${tree}` : '';
  return apiFetch(`/api/v1/stores/${storeId}/categories${query}`, { method: 'GET', skipCsrf: true });
}

export function createCategory(storeId: string, data: Partial<Category>): Promise<Category> {
  return apiFetch(`/api/v1/stores/${storeId}/categories`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCategory(storeId: string, categoryId: string, data: Partial<Category>): Promise<Category> {
  return apiFetch(`/api/v1/stores/${storeId}/categories/${categoryId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteCategory(storeId: string, categoryId: string): Promise<void> {
  return apiFetch(`/api/v1/stores/${storeId}/categories/${categoryId}`, { method: 'DELETE' });
}

export function listTags(storeId: string): Promise<ProductTag[]> {
  return apiFetch(`/api/v1/stores/${storeId}/tags`, { method: 'GET', skipCsrf: true });
}

export function createTag(storeId: string, data: Partial<ProductTag>): Promise<ProductTag> {
  return apiFetch(`/api/v1/stores/${storeId}/tags`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteTag(storeId: string, tagId: string): Promise<void> {
  return apiFetch(`/api/v1/stores/${storeId}/tags/${tagId}`, { method: 'DELETE' });
}
