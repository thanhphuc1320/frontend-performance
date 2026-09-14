import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductList } from './product-list';
import * as productApi from '../api';
import * as storeApi from '../../stores/api';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const mockProducts = {
  items: [
    {
      id: 'p1',
      storeId: 's1',
      name: 'Product One',
      slug: 'product-one',
      description: null,
      basePrice: 19.99,
      status: 'ACTIVE',
      createdBy: 'u1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'p2',
      storeId: 's1',
      name: 'Product Two',
      slug: 'product-two',
      description: null,
      basePrice: 29.99,
      status: 'DRAFT',
      createdBy: 'u1',
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    },
    {
      id: 'p3',
      storeId: 's1',
      name: 'Product Three',
      slug: 'product-three',
      description: null,
      basePrice: 39.99,
      status: 'ARCHIVED',
      createdBy: 'u1',
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
    },
  ],
  pagination: { page: 1, limit: 10, total: 3, totalPages: 1 },
};

describe('ProductList', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(storeApi, 'getCapabilities').mockResolvedValue({ permissions: ['products.manage'] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton', () => {
    vi.spyOn(productApi, 'listProducts').mockImplementation(() => new Promise(() => {}));
    render(React.createElement(ProductList, { storeId: 's1' }), { wrapper: createWrapper() });
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders products', async () => {
    vi.spyOn(productApi, 'listProducts').mockResolvedValueOnce(mockProducts as unknown as Awaited<ReturnType<typeof productApi.listProducts>>);
    render(React.createElement(ProductList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('Product One')).toBeInTheDocument());
    expect(screen.getByText('Product Two')).toBeInTheDocument();
    expect(screen.getByText('$19.99')).toBeInTheDocument();
    expect(screen.getByText('$29.99')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    vi.spyOn(productApi, 'listProducts').mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    } as unknown as Awaited<ReturnType<typeof productApi.listProducts>>);
    render(React.createElement(ProductList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('No products found')).toBeInTheDocument());
  });

  it('filters by status', async () => {
    const spy = vi.spyOn(productApi, 'listProducts')
      .mockResolvedValueOnce(mockProducts as unknown as Awaited<ReturnType<typeof productApi.listProducts>>)
      .mockResolvedValueOnce({
        items: [mockProducts.items[0]],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      } as unknown as Awaited<ReturnType<typeof productApi.listProducts>>);

    render(React.createElement(ProductList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('Product One')).toBeInTheDocument());

    const statusSelect = screen.getByLabelText('Filter by status');
    fireEvent.change(statusSelect, { target: { value: 'ACTIVE' } });

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith('s1', expect.objectContaining({ status: 'ACTIVE' })));
  });

  it('searches products', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const spy = vi.spyOn(productApi, 'listProducts')
      .mockResolvedValueOnce(mockProducts as unknown as Awaited<ReturnType<typeof productApi.listProducts>>)
      .mockResolvedValueOnce({
        items: [mockProducts.items[0]],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      } as unknown as Awaited<ReturnType<typeof productApi.listProducts>>);

    render(React.createElement(ProductList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('Product One')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('Search products...');
    fireEvent.change(searchInput, { target: { value: 'One' } });

    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith('s1', expect.objectContaining({ search: 'One' })));
    vi.useRealTimers();
  });

  it('paginates products', async () => {
    const paginatedData = {
      items: [mockProducts.items[0]],
      pagination: { page: 1, limit: 1, total: 3, totalPages: 3 },
    };
    const page2Data = {
      items: [mockProducts.items[1]],
      pagination: { page: 2, limit: 1, total: 3, totalPages: 3 },
    };

    const spy = vi.spyOn(productApi, 'listProducts')
      .mockResolvedValueOnce(paginatedData as unknown as Awaited<ReturnType<typeof productApi.listProducts>>)
      .mockResolvedValueOnce(page2Data as unknown as Awaited<ReturnType<typeof productApi.listProducts>>);

    render(React.createElement(ProductList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('Product One')).toBeInTheDocument());
    expect(screen.getByText('Showing 1–1 of 3')).toBeInTheDocument();

    const nextButton = screen.getByRole('button', { name: 'Next' });
    fireEvent.click(nextButton);

    await waitFor(() => expect(spy).toHaveBeenLastCalledWith('s1', expect.objectContaining({ page: 2 })));
  });

  it('archives a product', async () => {
    vi.spyOn(productApi, 'listProducts').mockResolvedValueOnce(mockProducts as unknown as Awaited<ReturnType<typeof productApi.listProducts>>);
    const archiveSpy = vi.spyOn(productApi, 'archiveProduct').mockResolvedValueOnce(undefined);

    render(React.createElement(ProductList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('Product One')).toBeInTheDocument());

    const archiveButtons = screen.getAllByRole('button', { name: /archive/i });
    expect(archiveButtons.length).toBe(2); // ACTIVE and DRAFT, not ARCHIVED

    fireEvent.click(archiveButtons[0]!);

    await waitFor(() => expect(archiveSpy).toHaveBeenCalledWith('s1', 'p1'));
  });

  it('hides archive button without products.manage permission', async () => {
    vi.spyOn(storeApi, 'getCapabilities').mockResolvedValue({ permissions: ['products.read'] });
    vi.spyOn(productApi, 'listProducts').mockResolvedValueOnce(mockProducts as unknown as Awaited<ReturnType<typeof productApi.listProducts>>);

    render(React.createElement(ProductList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('Product One')).toBeInTheDocument());

    const archiveButtons = screen.queryAllByRole('button', { name: /archive/i });
    expect(archiveButtons.length).toBe(0);
  });

  it('displays error state', async () => {
    vi.spyOn(productApi, 'listProducts').mockRejectedValueOnce(new productApi.ApiError(500, 'SERVER_ERROR', 'Server error'));
    render(React.createElement(ProductList, { storeId: 's1' }), { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
  });
});
