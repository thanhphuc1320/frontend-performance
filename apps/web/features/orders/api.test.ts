import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
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

const API_URL = 'http://localhost:4000';
const storeId = 's1';

function makeOrder(id: string): import('./types').Order {
  return {
    id,
    storeId,
    customerId: 'c1',
    orderNumber: `ORD-20240101-${id.slice(-3).padStart(3, '0')}`,
    status: 'PENDING',
    totalAmount: 100,
    shippingFee: 10,
    discountAmount: 0,
    finalAmount: 110,
    shippingAddress: null,
    shippingCity: null,
    shippingDistrict: null,
    shippingWard: null,
    paymentStatus: 'PENDING',
    paymentMethod: null,
    notes: null,
    createdBy: 'u1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

function makeCustomer(id: string): import('./types').Customer {
  return {
    id,
    storeId,
    userId: null,
    name: `Customer ${id}`,
    phone: '0901234567',
    email: null,
    address: null,
    city: null,
    district: null,
    ward: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

describe('orders API client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('document', { cookie: 'csrf_token=test-csrf' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetch(response: unknown, status = 200) {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
    } as Response);
  }

  describe('listOrders', () => {
    it('returns paginated orders on success', async () => {
      const paginated: import('./types').PaginatedOrders = {
        items: [makeOrder('o1')],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockFetch({ data: paginated });
      const result = await listOrders(storeId);
      expect(result).toEqual(paginated);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/orders`,
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
      );
    });

    it('applies filters as query params', async () => {
      mockFetch({
        data: { items: [], total: 0, page: 1, limit: 10, totalPages: 0 },
      });
      await listOrders(storeId, { status: 'PENDING', search: 'foo', page: 2, limit: 10 });
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/orders?status=PENDING&search=foo&page=2&limit=10`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('throws ApiError on failure', async () => {
      mockFetch({ error: { code: 'STORE_NOT_FOUND', message: 'Store not found' } }, 404);
      await expect(listOrders(storeId)).rejects.toThrow('Store not found');
    });
  });

  describe('getOrder', () => {
    it('returns order detail on success', async () => {
      const detail: import('./types').OrderDetail = {
        order: makeOrder('o1'),
        customer: makeCustomer('c1'),
        items: [],
        statusHistory: [],
      };
      mockFetch({ data: detail });
      const result = await getOrder(storeId, 'o1');
      expect(result).toEqual(detail);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/orders/o1`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('throws on 404', async () => {
      mockFetch({ error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
      await expect(getOrder(storeId, 'o99')).rejects.toThrow('Order not found');
    });
  });

  describe('createOrder', () => {
    it('returns created order', async () => {
      const order = makeOrder('o1');
      mockFetch({ data: order });
      const input: import('./types').CreateOrderInput = {
        customerId: 'c1',
        totalAmount: 100,
        shippingFee: 10,
        discountAmount: 0,
        finalAmount: 110,
        items: [
          {
            productId: 'p1',
            productName: 'Product 1',
            sku: 'SKU001',
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
        ],
      };
      const result = await createOrder(storeId, input);
      expect(result).toEqual(order);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/orders`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            'x-csrf-token': 'test-csrf',
          }),
          body: JSON.stringify(input),
        }),
      );
    });

    it('throws on 400', async () => {
      mockFetch({ error: { code: 'VALIDATION_ERROR', message: 'Customer ID is required' } }, 400);
      await expect(
        createOrder(storeId, {
          customerId: '',
          totalAmount: 0,
          shippingFee: 0,
          discountAmount: 0,
          finalAmount: 0,
          items: [],
        }),
      ).rejects.toThrow('Customer ID is required');
    });
  });

  describe('updateOrderStatus', () => {
    it('returns updated order', async () => {
      const order = { ...makeOrder('o1'), status: 'CONFIRMED' as const };
      mockFetch({ data: order });
      const result = await updateOrderStatus(storeId, 'o1', { status: 'CONFIRMED' });
      expect(result).toEqual(order);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/orders/o1/status`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'CONFIRMED' }),
        }),
      );
    });

    it('throws on invalid transition', async () => {
      mockFetch(
        { error: { code: 'INVALID_STATUS_TRANSITION', message: 'Cannot transition' } },
        400,
      );
      await expect(
        updateOrderStatus(storeId, 'o1', { status: 'DELIVERED' }),
      ).rejects.toThrow('Cannot transition');
    });
  });

  describe('cancelOrder', () => {
    it('returns void on success', async () => {
      mockFetch({ data: undefined });
      await expect(cancelOrder(storeId, 'o1')).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/orders/o1`,
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ notes: undefined }),
        }),
      );
    });

    it('throws on 404', async () => {
      mockFetch({ error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
      await expect(cancelOrder(storeId, 'o99')).rejects.toThrow('Order not found');
    });
  });

  describe('listCustomers', () => {
    it('returns customers array', async () => {
      const customers: import('./types').Customer[] = [makeCustomer('c1')];
      mockFetch({ data: customers });
      const result = await listCustomers(storeId);
      expect(result).toEqual(customers);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/customers`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('includes search param', async () => {
      mockFetch({ data: [] });
      await listCustomers(storeId, 'john');
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/customers?search=john`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('throws on 401', async () => {
      mockFetch({ error: { code: 'UNAUTHENTICATED', message: 'Auth required' } }, 401);
      await expect(listCustomers(storeId)).rejects.toThrow('Auth required');
    });
  });

  describe('getCustomer', () => {
    it('returns customer with orders', async () => {
      const customerWithOrders: import('./types').CustomerWithOrders = {
        customer: makeCustomer('c1'),
        recentOrders: [makeOrder('o1')],
      };
      mockFetch({ data: customerWithOrders });
      const result = await getCustomer(storeId, 'c1');
      expect(result).toEqual(customerWithOrders);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/customers/c1`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('throws on 404', async () => {
      mockFetch({ error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
      await expect(getCustomer(storeId, 'c99')).rejects.toThrow('Customer not found');
    });
  });

  describe('createCustomer', () => {
    it('returns created customer', async () => {
      const customer = makeCustomer('c1');
      mockFetch({ data: customer });
      const input: import('./types').CreateCustomerInput = {
        name: 'Customer c1',
        phone: '0901234567',
      };
      const result = await createCustomer(storeId, input);
      expect(result).toEqual(customer);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/customers`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            'x-csrf-token': 'test-csrf',
          }),
          body: JSON.stringify(input),
        }),
      );
    });

    it('throws on 400', async () => {
      mockFetch({ error: { code: 'VALIDATION_ERROR', message: 'Name is required' } }, 400);
      await expect(createCustomer(storeId, { name: '', phone: '' })).rejects.toThrow(
        'Name is required',
      );
    });
  });

  describe('updateCustomer', () => {
    it('returns updated customer', async () => {
      const customer = { ...makeCustomer('c1'), name: 'Updated' };
      mockFetch({ data: customer });
      const result = await updateCustomer(storeId, 'c1', { name: 'Updated' });
      expect(result).toEqual(customer);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/customers/c1`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Updated' }),
        }),
      );
    });

    it('throws on 404', async () => {
      mockFetch({ error: { code: 'NOT_FOUND', message: 'Customer not found' } }, 404);
      await expect(updateCustomer(storeId, 'c99', {})).rejects.toThrow('Customer not found');
    });
  });

  describe('deleteCustomer', () => {
    it('returns void on success', async () => {
      mockFetch({ data: undefined });
      await expect(deleteCustomer(storeId, 'c1')).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/customers/c1`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('throws on 409 when customer has orders', async () => {
      mockFetch({ error: { code: 'CONFLICT', message: 'Customer has orders' } }, 409);
      await expect(deleteCustomer(storeId, 'c1')).rejects.toThrow('Customer has orders');
    });
  });
});
