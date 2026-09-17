import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CustomersPage from './page';
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

const mockCustomers = [
  {
    id: 'c1',
    storeId: 's1',
    userId: null,
    name: 'John Doe',
    phone: '0901234567',
    email: 'john@example.com',
    address: '123 Main St',
    city: 'HCM',
    district: 'District 1',
    ward: 'Ward 1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

describe('CustomersPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(storeApi, 'getCapabilities').mockResolvedValue({ permissions: ['orders.manage'] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton', () => {
    vi.spyOn(storeApi, 'listStores').mockImplementation(() => new Promise(() => {}));
    render(React.createElement(CustomersPage), { wrapper: createWrapper() });
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders customers list', async () => {
    vi.spyOn(storeApi, 'listStores').mockResolvedValueOnce([{ id: 's1', name: 'Store A' }]);
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValueOnce(mockCustomers);

    render(React.createElement(CustomersPage), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Customers')).toBeInTheDocument());
    expect(screen.getByText('Manage your customers')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
  });

  it('shows no store message when no store selected', async () => {
    vi.spyOn(storeApi, 'listStores').mockResolvedValueOnce([]);

    render(React.createElement(CustomersPage), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Please select a store to manage customers')).toBeInTheDocument());
  });
});
