import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomerList } from './customer-list';
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
  {
    id: 'c2',
    storeId: 's1',
    userId: null,
    name: 'Jane Smith',
    phone: '0909876543',
    email: null,
    address: null,
    city: null,
    district: null,
    ward: null,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

describe('CustomerList', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(storeApi, 'getCapabilities').mockResolvedValue({ permissions: ['orders.manage'] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton', () => {
    vi.spyOn(orderApi, 'listCustomers').mockImplementation(() => new Promise(() => {}));
    render(React.createElement(CustomerList, { storeId: 's1' }), { wrapper: createWrapper() });
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders customers', async () => {
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue(mockCustomers as unknown as Awaited<ReturnType<typeof orderApi.listCustomers>>);
    render(React.createElement(CustomerList, { storeId: 's1' }), { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('0901234567')).toBeInTheDocument();
    expect(screen.getByText('0909876543')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue([]);
    render(React.createElement(CustomerList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('No customers found')).toBeInTheDocument());
  });

  it('searches by name', async () => {
    const spy = vi.spyOn(orderApi, 'listCustomers')
      .mockResolvedValueOnce(mockCustomers as unknown as Awaited<ReturnType<typeof orderApi.listCustomers>>)
      .mockResolvedValueOnce([mockCustomers[0]] as unknown as Awaited<ReturnType<typeof orderApi.listCustomers>>);

    render(React.createElement(CustomerList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('Search by name or phone...');
    fireEvent.change(searchInput, { target: { value: 'John' } });

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith('s1', 'John'));
  });

  it('searches by phone', async () => {
    const spy = vi.spyOn(orderApi, 'listCustomers')
      .mockResolvedValueOnce(mockCustomers as unknown as Awaited<ReturnType<typeof orderApi.listCustomers>>)
      .mockResolvedValueOnce([mockCustomers[1]] as unknown as Awaited<ReturnType<typeof orderApi.listCustomers>>);

    render(React.createElement(CustomerList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('Search by name or phone...');
    fireEvent.change(searchInput, { target: { value: '0909876543' } });

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith('s1', '0909876543'));
  });

  it('calls onEdit when edit button clicked', async () => {
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue(mockCustomers as unknown as Awaited<ReturnType<typeof orderApi.listCustomers>>);
    const onEdit = vi.fn();

    render(React.createElement(CustomerList, { storeId: 's1', onEdit }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());

    const editButton = screen.getByRole('button', { name: 'Edit John Doe' });
    fireEvent.click(editButton);

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', name: 'John Doe' }));
  });

  it('deletes a customer with confirmation', async () => {
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue(mockCustomers as unknown as Awaited<ReturnType<typeof orderApi.listCustomers>>);
    const deleteSpy = vi.spyOn(orderApi, 'deleteCustomer').mockResolvedValue(undefined);
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(React.createElement(CustomerList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());

    const deleteButton = screen.getByRole('button', { name: 'Delete John Doe' });
    fireEvent.click(deleteButton);

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('s1', 'c1'));
    vi.unstubAllGlobals();
  });

  it('does not delete when confirmation is cancelled', async () => {
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue(mockCustomers as unknown as Awaited<ReturnType<typeof orderApi.listCustomers>>);
    const deleteSpy = vi.spyOn(orderApi, 'deleteCustomer').mockResolvedValue(undefined);
    vi.stubGlobal('confirm', vi.fn(() => false));

    render(React.createElement(CustomerList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());

    const deleteButton = screen.getByRole('button', { name: 'Delete John Doe' });
    fireEvent.click(deleteButton);

    expect(deleteSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('hides actions without orders.manage permission', async () => {
    vi.spyOn(storeApi, 'getCapabilities').mockResolvedValue({ permissions: ['orders.read'] });
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue(mockCustomers as unknown as Awaited<ReturnType<typeof orderApi.listCustomers>>);

    render(React.createElement(CustomerList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());

    const editButtons = screen.queryAllByRole('button', { name: /Edit/ });
    const deleteButtons = screen.queryAllByRole('button', { name: /Delete/ });
    expect(editButtons.length).toBe(0);
    expect(deleteButtons.length).toBe(0);
  });

  it('displays error state', async () => {
    vi.spyOn(orderApi, 'listCustomers').mockRejectedValueOnce(new orderApi.ApiError(500, 'SERVER_ERROR', 'Server error'));
    render(React.createElement(CustomerList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
  });

  it('shows dash for missing email', async () => {
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue([mockCustomers[1]] as unknown as Awaited<ReturnType<typeof orderApi.listCustomers>>);
    render(React.createElement(CustomerList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('Jane Smith')).toBeInTheDocument());
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
