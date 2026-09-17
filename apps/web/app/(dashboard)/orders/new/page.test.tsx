import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NewOrderPage from './page';
import * as storeApi from '../../../../features/stores/api';
import * as orderApi from '../../../../features/orders/api';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('NewOrderPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(storeApi, 'getCapabilities').mockResolvedValue({ permissions: ['orders.manage'] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton', () => {
    vi.spyOn(storeApi, 'listStores').mockImplementation(() => new Promise(() => {}));
    render(React.createElement(NewOrderPage), { wrapper: createWrapper() });
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders order form', async () => {
    vi.spyOn(storeApi, 'listStores').mockResolvedValueOnce([{ id: 's1', name: 'Store A' }]);
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValueOnce([]);
    vi.spyOn(orderApi, 'listOrders').mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    } as unknown as Awaited<ReturnType<typeof orderApi.listOrders>>);

    render(React.createElement(NewOrderPage), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('New Order')).toBeInTheDocument());
    expect(screen.getByText('Create a new order')).toBeInTheDocument();
    expect(screen.getByText('Customer')).toBeInTheDocument();
  });

  it('shows no store message when no store selected', async () => {
    vi.spyOn(storeApi, 'listStores').mockResolvedValueOnce([]);

    render(React.createElement(NewOrderPage), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Please select a store to create orders')).toBeInTheDocument());
  });
});
