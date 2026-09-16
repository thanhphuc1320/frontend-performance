import { ApiError } from '../auth/api';
export { ApiError };
import type {
  Order,
  OrderDetail,
  PaginatedOrders,
  OrderFilters,
  CreateOrderInput,
  CreateCustomerInput,
  Customer,
  CustomerWithOrders,
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

export function listOrders(storeId: string, filters?: OrderFilters): Promise<PaginatedOrders> {
  const query = filters
    ? '?' +
      new URLSearchParams(
        Object.entries(filters)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';
  return apiFetch(`/api/v1/stores/${storeId}/orders${query}`, { method: 'GET', skipCsrf: true });
}

export function getOrder(storeId: string, orderId: string): Promise<OrderDetail> {
  return apiFetch(`/api/v1/stores/${storeId}/orders/${orderId}`, { method: 'GET', skipCsrf: true });
}

export function createOrder(storeId: string, data: CreateOrderInput): Promise<Order> {
  return apiFetch(`/api/v1/stores/${storeId}/orders`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateOrderStatus(
  storeId: string,
  orderId: string,
  data: { status: import('./types').OrderStatus; notes?: string | null },
): Promise<Order> {
  return apiFetch(`/api/v1/stores/${storeId}/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function cancelOrder(storeId: string, orderId: string, notes?: string | null): Promise<void> {
  return apiFetch(`/api/v1/stores/${storeId}/orders/${orderId}`, {
    method: 'DELETE',
    body: JSON.stringify({ notes }),
  });
}

export function listCustomers(storeId: string, search?: string): Promise<Customer[]> {
  const query = search !== undefined ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch(`/api/v1/stores/${storeId}/customers${query}`, { method: 'GET', skipCsrf: true });
}

export function getCustomer(storeId: string, customerId: string): Promise<CustomerWithOrders> {
  return apiFetch(`/api/v1/stores/${storeId}/customers/${customerId}`, {
    method: 'GET',
    skipCsrf: true,
  });
}

export function createCustomer(storeId: string, data: CreateCustomerInput): Promise<Customer> {
  return apiFetch(`/api/v1/stores/${storeId}/customers`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCustomer(
  storeId: string,
  customerId: string,
  data: Partial<Customer>,
): Promise<Customer> {
  return apiFetch(`/api/v1/stores/${storeId}/customers/${customerId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteCustomer(storeId: string, customerId: string): Promise<void> {
  return apiFetch(`/api/v1/stores/${storeId}/customers/${customerId}`, { method: 'DELETE' });
}
