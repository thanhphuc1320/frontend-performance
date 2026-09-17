import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderList } from './order-list';
import { OrderStatusBadge } from './order-status-badge';
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
    {
      id: 'o2',
      storeId: 's1',
      customerId: 'c2',
      orderNumber: 'ORD-002',
      status: 'CONFIRMED' as const,
      totalAmount: 200,
      shippingFee: 10,
      discountAmount: 20,
      finalAmount: 190,
      shippingAddress: null,
      shippingCity: null,
      shippingDistrict: null,
      shippingWard: null,
      paymentStatus: 'PAID' as const,
      paymentMethod: 'BANK_TRANSFER' as const,
      notes: null,
      createdBy: 'u1',
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
    {
      id: 'o3',
      storeId: 's1',
      customerId: 'c1',
      orderNumber: 'ORD-003',
      status: 'DELIVERED' as const,
      totalAmount: 50,
      shippingFee: 5,
      discountAmount: 0,
      finalAmount: 55,
      shippingAddress: null,
      shippingCity: null,
      shippingDistrict: null,
      shippingWard: null,
      paymentStatus: 'PAID' as const,
      paymentMethod: 'MOMO' as const,
      notes: null,
      createdBy: 'u1',
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
    },
  ],
  page: 1,
  limit: 10,
  total: 3,
  totalPages: 1,
};

describe('OrderList', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(storeApi, 'getCapabilities').mockResolvedValue({ permissions: ['orders.manage'] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton', () => {
    vi.spyOn(orderApi, 'listOrders').mockImplementation(() => new Promise(() => {}));
    render(React.createElement(OrderList, { storeId: 's1' }), { wrapper: createWrapper() });
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders orders', async () => {
    vi.spyOn(orderApi, 'listOrders').mockResolvedValueOnce(mockOrders as unknown as Awaited<ReturnType<typeof orderApi.listOrders>>);
    render(React.createElement(OrderList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());
    expect(screen.getByText('ORD-002')).toBeInTheDocument();
    expect(screen.getByText('ORD-003')).toBeInTheDocument();
    expect(screen.getByText('$110.00')).toBeInTheDocument();
    expect(screen.getByText('$190.00')).toBeInTheDocument();
    expect(screen.getByText('$55.00')).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    vi.spyOn(orderApi, 'listOrders').mockResolvedValueOnce({
      items: [],
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    } as unknown as Awaited<ReturnType<typeof orderApi.listOrders>>);
    render(React.createElement(OrderList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('No orders found')).toBeInTheDocument());
  });

  it('filters by status', async () => {
    const spy = vi.spyOn(orderApi, 'listOrders')
      .mockResolvedValueOnce(mockOrders as unknown as Awaited<ReturnType<typeof orderApi.listOrders>>)
      .mockResolvedValueOnce({
        items: [mockOrders.items[0]],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      } as unknown as Awaited<ReturnType<typeof orderApi.listOrders>>);

    render(React.createElement(OrderList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());

    const statusSelect = screen.getByLabelText('Filter by status');
    fireEvent.change(statusSelect, { target: { value: 'PENDING' } });

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith('s1', expect.objectContaining({ status: 'PENDING' })));
  });

  it('filters by date range', async () => {
    const spy = vi.spyOn(orderApi, 'listOrders')
      .mockResolvedValueOnce(mockOrders as unknown as Awaited<ReturnType<typeof orderApi.listOrders>>)
      .mockResolvedValueOnce({
        items: [mockOrders.items[0]],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      } as unknown as Awaited<ReturnType<typeof orderApi.listOrders>>);

    render(React.createElement(OrderList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());

    const dateFromInput = screen.getByLabelText('Date from');
    fireEvent.change(dateFromInput, { target: { value: '2024-01-01' } });

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith('s1', expect.objectContaining({ dateFrom: '2024-01-01' })));
  });

  it('searches by order number', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const spy = vi.spyOn(orderApi, 'listOrders')
      .mockResolvedValueOnce(mockOrders as unknown as Awaited<ReturnType<typeof orderApi.listOrders>>)
      .mockResolvedValueOnce({
        items: [mockOrders.items[0]],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      } as unknown as Awaited<ReturnType<typeof orderApi.listOrders>>);

    render(React.createElement(OrderList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('Search by order number...');
    fireEvent.change(searchInput, { target: { value: 'ORD-001' } });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith('s1', expect.objectContaining({ search: 'ORD-001' })));
    vi.useRealTimers();
  });

  it('paginates orders', async () => {
    const paginatedData = {
      items: [mockOrders.items[0]],
      page: 1,
      limit: 1,
      total: 3,
      totalPages: 3,
    };
    const page2Data = {
      items: [mockOrders.items[1]],
      page: 2,
      limit: 1,
      total: 3,
      totalPages: 3,
    };

    const spy = vi.spyOn(orderApi, 'listOrders')
      .mockResolvedValueOnce(paginatedData as unknown as Awaited<ReturnType<typeof orderApi.listOrders>>)
      .mockResolvedValueOnce(page2Data as unknown as Awaited<ReturnType<typeof orderApi.listOrders>>);

    render(React.createElement(OrderList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());
    expect(screen.getByText('Showing 1–1 of 3')).toBeInTheDocument();

    const nextButton = screen.getByRole('button', { name: 'Next' });
    fireEvent.click(nextButton);

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith('s1', expect.objectContaining({ page: 2 })));
  });

  it('updates order status', async () => {
    vi.spyOn(orderApi, 'listOrders').mockResolvedValueOnce(mockOrders as unknown as Awaited<ReturnType<typeof orderApi.listOrders>>);
    const updateSpy = vi.spyOn(orderApi, 'updateOrderStatus').mockResolvedValueOnce(mockOrders.items[0] as unknown as Awaited<ReturnType<typeof orderApi.updateOrderStatus>>);

    render(React.createElement(OrderList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());

    const statusSelects = screen.getAllByLabelText(/Update status for order/);
    expect(statusSelects.length).toBe(3);

    fireEvent.change(statusSelects[0]!, { target: { value: 'CONFIRMED' } });

    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith('s1', 'o1', { status: 'CONFIRMED' }));
  });

  it('hides status update dropdown without orders.manage permission', async () => {
    vi.spyOn(storeApi, 'getCapabilities').mockResolvedValue({ permissions: ['orders.read'] });
    vi.spyOn(orderApi, 'listOrders').mockResolvedValueOnce(mockOrders as unknown as Awaited<ReturnType<typeof orderApi.listOrders>>);

    render(React.createElement(OrderList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('ORD-001')).toBeInTheDocument());

    const statusSelects = screen.queryAllByLabelText(/Update status for order/);
    expect(statusSelects.length).toBe(0);
  });

  it('displays error state', async () => {
    vi.spyOn(orderApi, 'listOrders').mockRejectedValueOnce(new orderApi.ApiError(500, 'SERVER_ERROR', 'Server error'));
    render(React.createElement(OrderList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
  });
});

describe('OrderStatusBadge', () => {
  it('renders each status with correct label', () => {
    const statuses = [
      { status: 'PENDING' as const, label: 'Pending' },
      { status: 'CONFIRMED' as const, label: 'Confirmed' },
      { status: 'PROCESSING' as const, label: 'Processing' },
      { status: 'READY_TO_SHIP' as const, label: 'Ready to Ship' },
      { status: 'SHIPPED' as const, label: 'Shipped' },
      { status: 'DELIVERED' as const, label: 'Delivered' },
      { status: 'CANCELLED' as const, label: 'Cancelled' },
      { status: 'REFUNDED' as const, label: 'Refunded' },
    ];

    statuses.forEach(({ status, label }) => {
      const { container } = render(React.createElement(OrderStatusBadge, { status }));
      expect(container.textContent).toBe(label);
    });
  });
});
