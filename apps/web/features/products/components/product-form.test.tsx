import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProductForm } from './product-form';
import type { ProductDetail, Category, ProductTag } from '../types';

const mockCreateProduct = { mutate: vi.fn(), isPending: false, error: null };
const mockUpdateProduct = { mutate: vi.fn(), isPending: false, error: null };
const mockCreateTag = { mutate: vi.fn(), isPending: false, error: null };

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const mockCategories: Category[] = [
  { id: 'c1', storeId: 's1', name: 'Electronics', slug: 'electronics', parentId: null, sortOrder: 0 },
  { id: 'c2', storeId: 's1', name: 'Clothing', slug: 'clothing', parentId: null, sortOrder: 1 },
];

const mockTags: ProductTag[] = [
  { id: 't1', storeId: 's1', name: 'New' },
  { id: 't2', storeId: 's1', name: 'Sale' },
];

vi.mock('../queries', () => ({
  useCreateProduct: () => mockCreateProduct,
  useUpdateProduct: () => mockUpdateProduct,
  useCategories: () => ({ data: mockCategories }),
  useTags: () => ({ data: mockTags }),
  useCreateTag: () => mockCreateTag,
}));

describe('ProductForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateProduct.isPending = false;
    mockCreateProduct.error = null;
    mockUpdateProduct.isPending = false;
    mockUpdateProduct.error = null;
  });

  it('renders create mode', () => {
    render(React.createElement(ProductForm, { storeId: 's1' }), { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: /create product/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/slug/i)).toBeInTheDocument();
  });

  it('renders edit mode with pre-filled data', () => {
    const product: ProductDetail = {
      product: {
        id: 'p1',
        storeId: 's1',
        name: 'Test Product',
        slug: 'test-product',
        description: 'A test product',
        basePrice: 99.99,
        status: 'ACTIVE',
        createdBy: 'u1',
        createdAt: '',
        updatedAt: '',
      },
      variants: [],
      categories: [mockCategories[0]!],
      tags: [mockTags[0]!],
      images: [],
    };

    render(React.createElement(ProductForm, { storeId: 's1', product }), { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: /update product/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Product')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test-product')).toBeInTheDocument();
    expect(screen.getByDisplayValue('99.99')).toBeInTheDocument();
  });

  it('switches tabs', () => {
    render(React.createElement(ProductForm, { storeId: 's1' }), { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('tab', { name: /variants/i }));
    expect(screen.getByText('No variants yet. Add one to get started.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /images/i }));
    expect(screen.getByText('No images yet. Add one above.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /categories/i }));
    expect(screen.getByText('Electronics')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /tags/i }));
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('shows validation errors for required fields', async () => {
    render(React.createElement(ProductForm, { storeId: 's1' }), { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /create product/i }));

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/slug is required/i)).toBeInTheDocument();
    expect(screen.getByText(/base price must be a non-negative number/i)).toBeInTheDocument();
  });

  it('calls create product mutation on submit', async () => {
    render(React.createElement(ProductForm, { storeId: 's1' }), { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New Product' } });
    fireEvent.change(screen.getByLabelText(/slug/i), { target: { value: 'new-product' } });
    fireEvent.change(screen.getByLabelText(/base price/i), { target: { value: '49.99' } });

    fireEvent.click(screen.getByRole('button', { name: /create product/i }));

    await waitFor(() => {
      expect(mockCreateProduct.mutate).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockCreateProduct.mutate.mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
    expect(callArgs.storeId).toBe('s1');
    expect(callArgs.data).toMatchObject({
      name: 'New Product',
      slug: 'new-product',
      basePrice: 49.99,
      status: 'DRAFT',
    });
  });

  it('calls update product mutation on submit in edit mode', async () => {
    const product: ProductDetail = {
      product: {
        id: 'p1',
        storeId: 's1',
        name: 'Old Name',
        slug: 'old-name',
        description: null,
        basePrice: 10,
        status: 'DRAFT',
        createdBy: 'u1',
        createdAt: '',
        updatedAt: '',
      },
      variants: [],
      categories: [],
      tags: [],
      images: [],
    };

    render(React.createElement(ProductForm, { storeId: 's1', product }), { wrapper: createWrapper() });

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Updated Name' } });
    fireEvent.click(screen.getByRole('button', { name: /update product/i }));

    await waitFor(() => {
      expect(mockUpdateProduct.mutate).toHaveBeenCalledTimes(1);
    });

    const callArgs = mockUpdateProduct.mutate.mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
    expect(callArgs.storeId).toBe('s1');
    expect(callArgs.productId).toBe('p1');
    expect(callArgs.data).toMatchObject({
      name: 'Updated Name',
    });
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(React.createElement(ProductForm, { storeId: 's1', onCancel }), { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('toggles category selection', () => {
    render(React.createElement(ProductForm, { storeId: 's1' }), { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole('tab', { name: /categories/i }));

    const electronicsCheckbox = screen.getByLabelText('Electronics');
    fireEvent.click(electronicsCheckbox);
    expect(electronicsCheckbox).toBeChecked();

    fireEvent.click(electronicsCheckbox);
    expect(electronicsCheckbox).not.toBeChecked();
  });

  it('toggles tag selection', () => {
    render(React.createElement(ProductForm, { storeId: 's1' }), { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole('tab', { name: /tags/i }));

    const newTag = screen.getByText('New');
    fireEvent.click(newTag);
    expect(newTag).toHaveClass('bg-primary');

    fireEvent.click(newTag);
    expect(newTag).not.toHaveClass('bg-primary');
  });

  it('creates a new tag', async () => {
    mockCreateTag.mutate.mockImplementation((_vars: unknown, options: { onSuccess?: (tag: ProductTag) => void }) => {
      if (options?.onSuccess) {
        options.onSuccess({ id: 't3', storeId: 's1', name: 'Featured' });
      }
    });

    render(React.createElement(ProductForm, { storeId: 's1' }), { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole('tab', { name: /tags/i }));

    fireEvent.change(screen.getByPlaceholderText(/new tag name/i), { target: { value: 'Featured' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(mockCreateTag.mutate).toHaveBeenCalledTimes(1);
    });
  });
});
