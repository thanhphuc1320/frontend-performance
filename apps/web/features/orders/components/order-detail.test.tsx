import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderDetail } from './order-detail';
import * as orderApi from '../api';
import * as storeApi from '../../stores/api';

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

describe('OrderDetail', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(storeApi, 'getCapabilities').mockResolvedValue({ permissions: ['orders.manage'] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton', () => {
    vi.spyOn(orderApi, 'getOrder').mockImplementation(() => new Promise(() => {}));
    render(React.createElement(OrderDetail, { storeId: 's1', orderId: 'o1' }), { wrapper: createWrapper() });
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders order details', async () => {
    vi.spyOn(orderApi, 'getOrder').mockResolvedValue(mockOrderDetail as unknown as Awaited<ReturnType<typeof orderApi.getOrder>>);
    render(React.createElement(OrderDetail, { storeId: 's1', orderId: 'o1' }), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Product A')).toBeInTheDocument();
    expect(screen.getByText('SKU001')).toBeInTheDocument();
    expect(screen.getByText('$190.00')).toBeInTheDocument();
  });

  it('renders error state', async () => {
    vi.spyOn(orderApi, 'getOrder').mockRejectedValueOnce(new orderApi.ApiError(500, 'SERVER_ERROR', 'Server error'));
    render(React.createElement(OrderDetail, { storeId: 's1', orderId: 'o1' }), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
  });

  it('renders not found when no data', async () => {
    vi.spyOn(orderApi, 'getOrder').mockResolvedValue(null as unknown as Awaited<ReturnType<typeof orderApi.getOrder>>);
    render(React.createElement(OrderDetail, { storeId: 's1', orderId: 'o1' }), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Order not found')).toBeInTheDocument());
  });

  it('updates order status', async () => {
    vi.spyOn(orderApi, 'getOrder').mockResolvedValue(mockOrderDetail as unknown as Awaited<ReturnType<typeof orderApi.getOrder>>);
    const updateSpy = vi.spyOn(orderApi, 'updateOrderStatus').mockResolvedValueOnce({
      ...mockOrderDetail.order,
      status: 'CONFIRMED',
    } as unknown as Awaited<ReturnType<typeof orderApi.updateOrderStatus>>);

    render(React.createElement(OrderDetail, { storeId: 's1', orderId: 'o1' }), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());

    const statusSelect = screen.getByLabelText('Update order status');
    fireEvent.change(statusSelect, { target: { value: 'CONFIRMED' } });

    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith('s1', 'o1', { status: 'CONFIRMED' }));
  });

  it('shows cancel button for cancelable orders', async () => {
    vi.spyOn(orderApi, 'getOrder').mockResolvedValue(mockOrderDetail as unknown as Awaited<ReturnType<typeof orderApi.getOrder>>);
    render(React.createElement(OrderDetail, { storeId: 's1', orderId: 'o1' }), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Cancel Order/i })).toBeInTheDocument();
  });

  it('hides cancel button for non-cancelable orders', async () => {
    vi.spyOn(orderApi, 'getOrder').mockResolvedValue({
      ...mockOrderDetail,
      order: { ...mockOrderDetail.order, status: 'DELIVERED' },
    } as unknown as Awaited<ReturnType<typeof orderApi.getOrder>>);
    render(React.createElement(OrderDetail, { storeId: 's1', orderId: 'o1' }), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Cancel Order/i })).not.toBeInTheDocument();
  });

  it('cancels order with notes', async () => {
    vi.spyOn(orderApi, 'getOrder').mockResolvedValue(mockOrderDetail as unknown as Awaited<ReturnType<typeof orderApi.getOrder>>);
    const cancelSpy = vi.spyOn(orderApi, 'cancelOrder').mockResolvedValueOnce(undefined);

    render(React.createElement(OrderDetail, { storeId: 's1', orderId: 'o1' }), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Cancel Order/i }));

    const notesInput = screen.getByPlaceholderText('Cancellation reason...');
    fireEvent.change(notesInput, { target: { value: 'Customer request' } });

    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));

    await waitFor(() => expect(cancelSpy).toHaveBeenCalledWith('s1', 'o1', 'Customer request'));
  });

  it('hides status controls without orders.manage permission', async () => {
    vi.spyOn(storeApi, 'getCapabilities').mockResolvedValue({ permissions: ['orders.read'] });
    vi.spyOn(orderApi, 'getOrder').mockResolvedValue(mockOrderDetail as unknown as Awaited<ReturnType<typeof orderApi.getOrder>>);
    render(React.createElement(OrderDetail, { storeId: 's1', orderId: 'o1' }), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());
    expect(screen.queryByLabelText('Update order status')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancel Order/i })).not.toBeInTheDocument();
  });

  it('renders status history timeline', async () => {
    vi.spyOn(orderApi, 'getOrder').mockResolvedValue({
      ...mockOrderDetail,
      statusHistory: [
        ...mockOrderDetail.statusHistory,
        {
          id: 'h2',
          orderId: 'o1',
          status: 'CONFIRMED' as const,
          notes: 'Payment received',
          createdBy: 'u2',
          createdAt: '2024-01-01T11:00:00Z',
        },
      ],
    } as unknown as Awaited<ReturnType<typeof orderApi.getOrder>>);
    render(React.createElement(OrderDetail, { storeId: 's1', orderId: 'o1' }), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Status History')).toBeInTheDocument());
    expect(screen.getByText('Payment received')).toBeInTheDocument();
    expect(screen.getByText('by u2')).toBeInTheDocument();
  });

  it('renders shipping and payment info', async () => {
    vi.spyOn(orderApi, 'getOrder').mockResolvedValue(mockOrderDetail as unknown as Awaited<ReturnType<typeof orderApi.getOrder>>);
    render(React.createElement(OrderDetail, { storeId: 's1', orderId: 'o1' }), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('123 Main St')).toBeInTheDocument());
    expect(screen.getByText('Ward 1, District 1, HCM')).toBeInTheDocument();

    expect(screen.getByText('COD')).toBeInTheDocument();
    expect(screen.getByText('COD')).toBeInTheDocument();
    expect(screen.getByText('Please handle with care')).toBeInTheDocument();
  });
});
