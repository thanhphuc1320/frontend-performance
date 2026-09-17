import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OrdersPage from './page';
import * as storeApi from '../../../features/stores/api';
import * as orderApi from '../../../features/orders/api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const mockOrders = {
  items: [
    {
      id: 'o1',
      storeId: 's1',
      customerId: 'c1',
      orderNumber: 'ORD-001',
      status: 'PENDING' as const,
      totalAmount: 100,
      shippingFee: 10,
      discountAmount: 0,
      finalAmount: 110,
      shippingAddress: null,
      shippingCity: null,
      shippingDistrict: null,
      shippingWard: null,
      paymentStatus: 'PENDING' as const,
      paymentMethod: 'COD' as const,
      notes: null,
      createdBy: 'u1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ],
  pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
};

describe('OrdersPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(storeApi, 'getCapabilities').mockResolvedValue({ permissions: ['orders.manage'] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton', () => {
    vi.spyOn(storeApi, 'listStores').mockImplementation(() => new Promise(() => {}));
    render(React.createElement(OrdersPage), { wrapper: createWrapper() });
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders orders list', async () => {
    vi.spyOn(storeApi, 'listStores').mockResolvedValueOnce([{ id: 's1', name: 'Store A' }]);
    vi.spyOn(orderApi, 'listOrders').mockResolvedValueOnce(mockOrders as unknown as Awaited<ReturnType<typeof orderApi.listOrders>>);

    render(React.createElement(OrdersPage), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Orders')).toBeInTheDocument());
    expect(screen.getByText('Manage your store orders')).toBeInTheDocument();
    expect(screen.getByText('Create Order')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());
  });

  it('shows no store message when no store selected', async () => {
    vi.spyOn(storeApi, 'listStores').mockResolvedValueOnce([]);

    render(React.createElement(OrdersPage), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Please select a store to manage orders')).toBeInTheDocument());
  });
});
