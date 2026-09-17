import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OrderDetailPage from './page';
import * as storeApi from '../../../../features/stores/api';
import * as orderApi from '../../../../features/orders/api';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'o1' }),
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

const mockOrderDetail = {
  order: {
    id: 'o1',
    storeId: 's1',
    customerId: 'c1',
    orderNumber: 'ORD-001',
    status: 'PENDING' as const,
    totalAmount: 200,
    shippingFee: 10,
    discountAmount: 20,
    finalAmount: 190,
    shippingAddress: '123 Main St',
    shippingCity: 'HCM',
    shippingDistrict: 'District 1',
    shippingWard: 'Ward 1',
    paymentStatus: 'PENDING' as const,
    paymentMethod: 'COD' as const,
    notes: 'Please handle with care',
    createdBy: 'u1',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
  },
  customer: {
    id: 'c1',
    storeId: 's1',
    userId: null,
    name: 'John Doe',
    phone: '0901234567',
    email: 'john@example.com',
    address: '456 Customer St',
    city: 'HCM',
    district: 'District 2',
    ward: 'Ward 2',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  items: [
    {
      id: 'i1',
      orderId: 'o1',
      productId: 'p1',
      variantId: null,
      productName: 'Product A',
      variantName: null,
      sku: 'SKU001',
      quantity: 2,
      unitPrice: 100,
      totalPrice: 200,
    },
  ],
  statusHistory: [
    {
      id: 'h1',
      orderId: 'o1',
      status: 'PENDING' as const,
      notes: null,
      createdBy: 'u1',
      createdAt: '2024-01-01T10:00:00Z',
    },
  ],
};

describe('OrderDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(storeApi, 'getCapabilities').mockResolvedValue({ permissions: ['orders.manage'] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton', () => {
    vi.spyOn(storeApi, 'listStores').mockImplementation(() => new Promise(() => {}));
    render(React.createElement(OrderDetailPage), { wrapper: createWrapper() });
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders order detail', async () => {
    vi.spyOn(storeApi, 'listStores').mockResolvedValueOnce([{ id: 's1', name: 'Store A' }]);
    vi.spyOn(orderApi, 'getOrder').mockResolvedValueOnce(mockOrderDetail as unknown as Awaited<ReturnType<typeof orderApi.getOrder>>);

    render(React.createElement(OrderDetailPage), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('shows no store message when no store selected', async () => {
    vi.spyOn(storeApi, 'listStores').mockResolvedValueOnce([]);

    render(React.createElement(OrderDetailPage), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Please select a store to view orders')).toBeInTheDocument());
  });
});
