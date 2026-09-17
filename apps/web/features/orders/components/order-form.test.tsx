import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderForm } from './order-form';
import * as orderApi from '../api';
import * as productApi from '../../products/api';
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
];

const mockProducts = {
  items: [
    {
      id: 'p1',
      storeId: 's1',
      name: 'Test Product',
      slug: 'test-product',
      description: null,
      basePrice: 100,
      status: 'ACTIVE' as const,
      createdBy: 'u1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const mockProductDetail = {
  product: mockProducts.items[0],
  variants: [
    {
      id: 'v1',
      productId: 'p1',
      sku: 'SKU001',
      name: 'Default',
      priceDelta: 0,
      status: 'ACTIVE' as const,
      options: [],
      inventory: null,
    },
  ],
  categories: [],
  tags: [],
  images: [],
};

describe('OrderForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(storeApi, 'getCapabilities').mockResolvedValue({ permissions: ['orders.manage'] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders form sections', () => {
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue([]);
    render(React.createElement(OrderForm, { storeId: 's1' }), { wrapper: createWrapper() });

    expect(screen.getByText('Customer')).toBeInTheDocument();
    expect(screen.getByText('Items')).toBeInTheDocument();
    expect(screen.getByText('Shipping & Payment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Order/i })).toBeInTheDocument();
  });

  it('searches and selects a customer', async () => {
    const spy = vi.spyOn(orderApi, 'listCustomers').mockResolvedValue(mockCustomers as unknown as Awaited<ReturnType<typeof orderApi.listCustomers>>);
    render(React.createElement(OrderForm, { storeId: 's1' }), { wrapper: createWrapper() });

    const searchInput = screen.getByPlaceholderText('Search customers by name or phone...');
    fireEvent.change(searchInput, { target: { value: 'John' } });

    await waitFor(() => expect(spy).toHaveBeenCalledWith('s1', 'John'));
    await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());

    fireEvent.click(screen.getByText('John Doe'));
    await waitFor(() => expect(screen.getByText('0901234567')).toBeInTheDocument());
  });

  it('shows create customer form', async () => {
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue([]);
    render(React.createElement(OrderForm, { storeId: 's1' }), { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /Create new customer/i }));

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Phone')).toBeInTheDocument();
  });

  it('validates required fields on submit', async () => {
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue([]);
    render(React.createElement(OrderForm, { storeId: 's1' }), { wrapper: createWrapper() });

    // Wait for capabilities to load (button becomes enabled)
    await waitFor(() => expect(screen.getByRole('button', { name: /Create Order/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Create Order/i }));

    await waitFor(() => expect(screen.getByText('Please select or create a customer')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('At least one item is required')).toBeInTheDocument());
  });

  it('searches and adds a product', async () => {
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue([]);
    vi.spyOn(productApi, 'listProducts').mockResolvedValue(mockProducts as unknown as Awaited<ReturnType<typeof productApi.listProducts>>);
    vi.spyOn(productApi, 'getProduct').mockResolvedValue(mockProductDetail as unknown as Awaited<ReturnType<typeof productApi.getProduct>>);

    render(React.createElement(OrderForm, { storeId: 's1' }), { wrapper: createWrapper() });

    const productSearch = screen.getByPlaceholderText('Search products...');
    fireEvent.change(productSearch, { target: { value: 'Test' } });

    await waitFor(() => expect(screen.getByText('Test Product')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Test Product'));
    await waitFor(() => expect(screen.getByRole('button', { name: /Add to order/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Add to order/i }));
    await waitFor(() => expect(screen.getByText('SKU001')).toBeInTheDocument());
  });

  it('updates item quantity and recalculates total', async () => {
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue([]);
    vi.spyOn(productApi, 'listProducts').mockResolvedValue(mockProducts as unknown as Awaited<ReturnType<typeof productApi.listProducts>>);
    vi.spyOn(productApi, 'getProduct').mockResolvedValue(mockProductDetail as unknown as Awaited<ReturnType<typeof productApi.getProduct>>);

    render(React.createElement(OrderForm, { storeId: 's1' }), { wrapper: createWrapper() });

    const productSearch = screen.getByPlaceholderText('Search products...');
    fireEvent.change(productSearch, { target: { value: 'Test' } });

    await waitFor(() => expect(screen.getByText('Test Product')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test Product'));
    await waitFor(() => expect(screen.getByRole('button', { name: /Add to order/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Add to order/i }));

    await waitFor(() => expect(screen.getByText('SKU001')).toBeInTheDocument());

    const qtyInput = screen.getByDisplayValue('1');
    fireEvent.change(qtyInput, { target: { value: '3' } });

    // Check the total column for the item row specifically
    await waitFor(() => {
      const totals = screen.getAllByText('$300.00');
      expect(totals.length).toBeGreaterThan(0);
    });
  });

  it('removes an item from the order', async () => {
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue([]);
    vi.spyOn(productApi, 'listProducts').mockResolvedValue(mockProducts as unknown as Awaited<ReturnType<typeof productApi.listProducts>>);
    vi.spyOn(productApi, 'getProduct').mockResolvedValue(mockProductDetail as unknown as Awaited<ReturnType<typeof productApi.getProduct>>);

    render(React.createElement(OrderForm, { storeId: 's1' }), { wrapper: createWrapper() });

    const productSearch = screen.getByPlaceholderText('Search products...');
    fireEvent.change(productSearch, { target: { value: 'Test' } });
    await waitFor(() => expect(screen.getByText('Test Product')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test Product'));
    await waitFor(() => expect(screen.getByRole('button', { name: /Add to order/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Add to order/i }));

    await waitFor(() => expect(screen.getByText('SKU001')).toBeInTheDocument());

    const removeButton = screen.getByRole('button', { name: '' });
    fireEvent.click(removeButton);

    await waitFor(() => expect(screen.queryByText('SKU001')).not.toBeInTheDocument());
  });

  it('submits order with selected customer and items', async () => {
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue(mockCustomers as unknown as Awaited<ReturnType<typeof orderApi.listCustomers>>);
    vi.spyOn(productApi, 'listProducts').mockResolvedValue(mockProducts as unknown as Awaited<ReturnType<typeof productApi.listProducts>>);
    vi.spyOn(productApi, 'getProduct').mockResolvedValue(mockProductDetail as unknown as Awaited<ReturnType<typeof productApi.getProduct>>);
    const createSpy = vi.spyOn(orderApi, 'createOrder').mockResolvedValue({
      id: 'o1',
      storeId: 's1',
      customerId: 'c1',
      orderNumber: 'ORD-001',
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
    } as unknown as Awaited<ReturnType<typeof orderApi.createOrder>>);

    const onSuccess = vi.fn();
    render(React.createElement(OrderForm, { storeId: 's1', onSuccess }), { wrapper: createWrapper() });

    // Select customer
    const searchInput = screen.getByPlaceholderText('Search customers by name or phone...');
    fireEvent.change(searchInput, { target: { value: 'John' } });
    await waitFor(() => expect(screen.getByText('John Doe')).toBeInTheDocument());
    fireEvent.click(screen.getByText('John Doe'));

    // Add product
    const productSearch = screen.getByPlaceholderText('Search products...');
    fireEvent.change(productSearch, { target: { value: 'Test' } });
    await waitFor(() => expect(screen.getByText('Test Product')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test Product'));
    await waitFor(() => expect(screen.getByRole('button', { name: /Add to order/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Add to order/i }));

    // Set shipping fee
    const shippingInput = screen.getAllByRole('spinbutton').find((el) => el.previousElementSibling?.textContent === 'Shipping Fee');
    fireEvent.change(shippingInput!, { target: { value: '10' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Create Order/i }));

    await waitFor(() => expect(createSpy).toHaveBeenCalled());
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    const callData = createSpy.mock.calls[0]![1];
    expect(callData.customerId).toBe('c1');
    expect(callData.items).toHaveLength(1);
    expect(callData.shippingFee).toBe(10);
    expect(callData.finalAmount).toBe(110);
  });

  it('creates new customer inline and submits', async () => {
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue([]);
    vi.spyOn(productApi, 'listProducts').mockResolvedValue(mockProducts as unknown as Awaited<ReturnType<typeof productApi.listProducts>>);
    vi.spyOn(productApi, 'getProduct').mockResolvedValue(mockProductDetail as unknown as Awaited<ReturnType<typeof productApi.getProduct>>);
    const createCustomerSpy = vi.spyOn(orderApi, 'createCustomer').mockResolvedValue(mockCustomers[0] as unknown as Awaited<ReturnType<typeof orderApi.createCustomer>>);
    const createOrderSpy = vi.spyOn(orderApi, 'createOrder').mockResolvedValue({
      id: 'o1',
      storeId: 's1',
      customerId: 'c1',
      orderNumber: 'ORD-001',
      status: 'PENDING',
      totalAmount: 100,
      shippingFee: 0,
      discountAmount: 0,
      finalAmount: 100,
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
    } as unknown as Awaited<ReturnType<typeof orderApi.createOrder>>);

    render(React.createElement(OrderForm, { storeId: 's1' }), { wrapper: createWrapper() });

    // Show create customer form
    fireEvent.click(screen.getByRole('button', { name: /Create new customer/i }));

    // Fill customer form
    const nameInput = screen.getByText('Name').closest('div')?.querySelector('input');
    const phoneInput = screen.getByText('Phone').closest('div')?.querySelector('input');
    fireEvent.change(nameInput!, { target: { value: 'Jane Doe' } });
    fireEvent.change(phoneInput!, { target: { value: '0909876543' } });

    // Add product
    const productSearch = screen.getByPlaceholderText('Search products...');
    fireEvent.change(productSearch, { target: { value: 'Test' } });
    await waitFor(() => expect(screen.getByText('Test Product')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test Product'));
    await waitFor(() => expect(screen.getByRole('button', { name: /Add to order/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Add to order/i }));

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Create Order/i }));

    await waitFor(() => expect(createCustomerSpy).toHaveBeenCalled());
    await waitFor(() => expect(createOrderSpy).toHaveBeenCalled());
  });

  it('disables submit without orders.manage permission', () => {
    vi.spyOn(storeApi, 'getCapabilities').mockResolvedValue({ permissions: ['orders.read'] });
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue([]);
    render(React.createElement(OrderForm, { storeId: 's1' }), { wrapper: createWrapper() });

    const submitButton = screen.getByRole('button', { name: /Create Order/i });
    expect(submitButton).toBeDisabled();
  });

  it('shows validation errors for new customer fields', async () => {
    vi.spyOn(orderApi, 'listCustomers').mockResolvedValue([]);
    render(React.createElement(OrderForm, { storeId: 's1' }), { wrapper: createWrapper() });

    fireEvent.click(screen.getByRole('button', { name: /Create new customer/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Create Order/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /Create Order/i }));

    await waitFor(() => expect(screen.getByText('Name is required')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Phone is required')).toBeInTheDocument());
  });
});
