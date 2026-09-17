'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Search, Plus, Trash2, X } from 'lucide-react';
import { useCustomers, useCreateCustomer, useCreateOrder } from '../queries';
import { useProducts, useProduct } from '../../products/queries';
import { useCapabilities } from '../../stores/queries';
import type {
  Customer,
  CreateCustomerInput,
  CreateOrderInput,
  CreateOrderItemInput,
  PaymentMethod,
} from '../types';
import type { ProductVariant } from '../../products/types';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { FormError } from '../../../components/ui/form-error';
import { Spinner } from '../../../components/ui/spinner';

interface OrderFormProps {
  storeId: string;
  onSuccess?: () => void;
}

interface FormItem {
  id: string;
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  availableVariants: ProductVariant[];
}

const paymentMethods: { label: string; value: PaymentMethod }[] = [
  { label: 'Cash on Delivery', value: 'COD' },
  { label: 'Bank Transfer', value: 'BANK_TRANSFER' },
  { label: 'MoMo', value: 'MOMO' },
  { label: 'VNPay', value: 'VNPAY' },
];

function generateItemId() {
  return `item-${Math.random().toString(36).slice(2, 9)}`;
}

export function OrderForm({ storeId, onSuccess }: OrderFormProps) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState<CreateCustomerInput>({
    name: '',
    phone: '',
    email: null,
    address: null,
    city: null,
    district: null,
    ward: null,
  });

  const [items, setItems] = useState<FormItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const [shippingFee, setShippingFee] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingDistrict, setShippingDistrict] = useState('');
  const [shippingWard, setShippingWard] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: customers, isLoading: customersLoading } = useCustomers(storeId, customerSearch || undefined);
  const createCustomerMutation = useCreateCustomer();
  const createOrderMutation = useCreateOrder();

  const { data: productsData, isLoading: productsLoading } = useProducts(storeId, {
    search: productSearch || undefined,
    status: 'ACTIVE',
    limit: 20,
  });

  const { data: productDetailData } = useProduct(storeId, selectedProductId ?? '');

  const { data: capabilities } = useCapabilities();
  const canUpdate = capabilities?.permissions.includes('orders.update') ?? false;

  const products = productsData?.items ?? [];
  const productDetail = productDetailData
    ? {
        product: productDetailData.product,
        variants: productDetailData.variants.filter((v) => v.status === 'ACTIVE'),
      }
    : null;

  const handleSelectCustomer = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    setShippingAddress((prev) => prev || customer.address || '');
    setShippingCity((prev) => prev || customer.city || '');
    setShippingDistrict((prev) => prev || customer.district || '');
    setShippingWard((prev) => prev || customer.ward || '');
  }, []);

  const handleClearCustomer = useCallback(() => {
    setSelectedCustomer(null);
    setShowCreateCustomer(false);
    setCustomerForm({ name: '', phone: '', email: null, address: null, city: null, district: null, ward: null });
  }, []);

  const handleAddItem = useCallback(() => {
    if (!productDetail) return;
    const product = productDetail.product;
    let variant: ProductVariant | undefined;

    if (productDetail.variants.length === 1) {
      variant = productDetail.variants[0];
    } else if (selectedVariantId) {
      variant = productDetail.variants.find((v) => v.id === selectedVariantId);
    }

    if (productDetail.variants.length > 1 && !variant) return;

    const unitPrice = variant ? product.basePrice + variant.priceDelta : product.basePrice;
    const sku = variant ? variant.sku : product.slug;
    const newItem: FormItem = {
      id: generateItemId(),
      productId: product.id,
      productName: product.name,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      sku,
      quantity: 1,
      unitPrice,
      totalPrice: unitPrice,
      availableVariants: productDetail.variants,
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedProductId(null);
    setSelectedVariantId(null);
    setProductSearch('');
  }, [productDetail, selectedVariantId]);

  const handleUpdateItem = useCallback((id: string, updates: Partial<FormItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        if ('quantity' in updates || 'unitPrice' in updates) {
          updated.totalPrice = updated.quantity * updated.unitPrice;
        }
        return updated;
      })
    );
  }, []);

  const handleRemoveItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleVariantChange = useCallback(
    (itemId: string, variantId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      const variant = item.availableVariants.find((v) => v.id === variantId);
      if (!variant) return;
      const unitPrice = item.unitPrice - (item.availableVariants.find((v) => v.id === item.variantId)?.priceDelta ?? 0) + variant.priceDelta;
      handleUpdateItem(itemId, {
        variantId: variant.id,
        variantName: variant.name,
        sku: variant.sku,
        unitPrice,
        totalPrice: item.quantity * unitPrice,
      });
    },
    [items, handleUpdateItem]
  );

  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.totalPrice, 0), [items]);
  const finalAmount = useMemo(() => totalAmount + shippingFee - discountAmount, [totalAmount, shippingFee, discountAmount]);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedCustomer && !showCreateCustomer) {
      newErrors.customer = 'Please select or create a customer';
    }

    if (showCreateCustomer) {
      if (!customerForm.name.trim()) newErrors.customerName = 'Name is required';
      if (!customerForm.phone.trim()) newErrors.customerPhone = 'Phone is required';
    }

    if (items.length === 0) {
      newErrors.items = 'At least one item is required';
    }

    items.forEach((item) => {
      if (item.quantity <= 0) {
        newErrors[`quantity-${item.id}`] = 'Quantity must be greater than 0';
      }
    });

    if (finalAmount < 0) {
      newErrors.total = 'Final amount cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedCustomer, showCreateCustomer, customerForm, items, finalAmount]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      if (!canUpdate) {
        setSubmitError('You do not have permission to create orders');
        return;
      }

      if (!validate()) return;

      try {
        let customerId = selectedCustomer?.id;

        if (showCreateCustomer && !customerId) {
          const newCustomer = await createCustomerMutation.mutateAsync({
            storeId,
            data: customerForm,
          });
          customerId = newCustomer.id;
        }

        if (!customerId) {
          setErrors((prev) => ({ ...prev, customer: 'Customer is required' }));
          return;
        }

        const orderItems: CreateOrderItemInput[] = items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        }));

        const data: CreateOrderInput = {
          customerId,
          totalAmount,
          shippingFee,
          discountAmount,
          finalAmount,
          shippingAddress: shippingAddress || null,
          shippingCity: shippingCity || null,
          shippingDistrict: shippingDistrict || null,
          shippingWard: shippingWard || null,
          paymentMethod,
          notes: notes || null,
          items: orderItems,
        };

        await createOrderMutation.mutateAsync({ storeId, data });
        onSuccess?.();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to create order');
      }
    },
    [
      canUpdate,
      validate,
      selectedCustomer,
      showCreateCustomer,
      customerForm,
      createCustomerMutation,
      storeId,
      items,
      totalAmount,
      shippingFee,
      discountAmount,
      finalAmount,
      shippingAddress,
      shippingCity,
      shippingDistrict,
      shippingWard,
      paymentMethod,
      notes,
      createOrderMutation,
      onSuccess,
    ]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitError && (
        <div className="rounded-lg border border-danger bg-danger-light p-4 text-sm text-danger">
          {submitError}
        </div>
      )}

      {/* Customer Section */}
      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedCustomer ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-gray-50 p-3">
              <div>
                <p className="font-medium text-text-primary">{selectedCustomer.name}</p>
                <p className="text-sm text-text-secondary">{selectedCustomer.phone}</p>
                {selectedCustomer.email && (
                  <p className="text-sm text-text-secondary">{selectedCustomer.email}</p>
                )}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={handleClearCustomer}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  placeholder="Search customers by name or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-9"
                />
                {customersLoading && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Spinner size="sm" />
                  </div>
                )}
              </div>

              {customerSearch && customers && customers.length > 0 && (
                <div className="rounded-lg border border-border bg-white shadow-sm">
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => handleSelectCustomer(customer)}
                      className="flex w-full flex-col items-start border-b border-border px-4 py-3 text-left last:border-0 hover:bg-gray-50"
                    >
                      <span className="font-medium text-text-primary">{customer.name}</span>
                      <span className="text-sm text-text-secondary">{customer.phone}</span>
                    </button>
                  ))}
                </div>
              )}

              {customerSearch && customers && customers.length === 0 && !customersLoading && (
                <p className="text-sm text-text-muted">No customers found</p>
              )}

              {!showCreateCustomer && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCreateCustomer(true)}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Create new customer
                </Button>
              )}

              {showCreateCustomer && (
                <div className="space-y-3 rounded-lg border border-border bg-gray-50 p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label required>Name</Label>
                      <Input
                        value={customerForm.name}
                        onChange={(e) => setCustomerForm((prev) => ({ ...prev, name: e.target.value }))}
                        error={!!errors.customerName}
                      />
                      {errors.customerName && <FormError>{errors.customerName}</FormError>}
                    </div>
                    <div>
                      <Label required>Phone</Label>
                      <Input
                        value={customerForm.phone}
                        onChange={(e) => setCustomerForm((prev) => ({ ...prev, phone: e.target.value }))}
                        error={!!errors.customerPhone}
                      />
                      {errors.customerPhone && <FormError>{errors.customerPhone}</FormError>}
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={customerForm.email ?? ''}
                        onChange={(e) =>
                          setCustomerForm((prev) => ({ ...prev, email: e.target.value || null }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Address</Label>
                      <Input
                        value={customerForm.address ?? ''}
                        onChange={(e) =>
                          setCustomerForm((prev) => ({ ...prev, address: e.target.value || null }))
                        }
                      />
                    </div>
                    <div>
                      <Label>City</Label>
                      <Input
                        value={customerForm.city ?? ''}
                        onChange={(e) =>
                          setCustomerForm((prev) => ({ ...prev, city: e.target.value || null }))
                        }
                      />
                    </div>
                    <div>
                      <Label>District</Label>
                      <Input
                        value={customerForm.district ?? ''}
                        onChange={(e) =>
                          setCustomerForm((prev) => ({ ...prev, district: e.target.value || null }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Ward</Label>
                      <Input
                        value={customerForm.ward ?? ''}
                        onChange={(e) =>
                          setCustomerForm((prev) => ({ ...prev, ward: e.target.value || null }))
                        }
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCreateCustomer(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {errors.customer && <FormError>{errors.customer}</FormError>}
            </>
          )}
        </CardContent>
      </Card>

      {/* Items Section */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9"
              />
              {productsLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Spinner size="sm" />
                </div>
              )}
            </div>
          </div>

          {productSearch && products.length > 0 && !selectedProductId && (
            <div className="rounded-lg border border-border bg-white shadow-sm">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setSelectedProductId(product.id)}
                  className="flex w-full items-center justify-between border-b border-border px-4 py-3 text-left last:border-0 hover:bg-gray-50"
                >
                  <span className="font-medium text-text-primary">{product.name}</span>
                  <span className="text-sm text-text-secondary">${product.basePrice.toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}

          {selectedProductId && productDetail && (
            <div className="space-y-3 rounded-lg border border-border bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-primary">{productDetail.product.name}</p>
                  <p className="text-sm text-text-secondary">${productDetail.product.basePrice.toFixed(2)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedProductId(null);
                    setSelectedVariantId(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {productDetail.variants.length > 1 && (
                <div>
                  <Label>Select variant</Label>
                  <select
                    value={selectedVariantId ?? ''}
                    onChange={(e) => setSelectedVariantId(e.target.value || null)}
                    className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                  >
                    <option value="">Choose a variant...</option>
                    {productDetail.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.name ?? variant.sku} (
                        {(productDetail.product.basePrice + variant.priceDelta).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleAddItem}
                disabled={productDetail.variants.length > 1 && !selectedVariantId}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add to order
              </Button>
            </div>
          )}

          {/* Items Table */}
          {items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 text-left font-medium text-text-secondary">Product</th>
                    <th className="py-2 pr-4 text-left font-medium text-text-secondary">Variant</th>
                    <th className="py-2 pr-4 text-left font-medium text-text-secondary">SKU</th>
                    <th className="py-2 pr-4 text-right font-medium text-text-secondary">Price</th>
                    <th className="py-2 pr-4 text-center font-medium text-text-secondary">Qty</th>
                    <th className="py-2 pr-4 text-right font-medium text-text-secondary">Total</th>
                    <th className="py-2 text-right font-medium text-text-secondary"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4 text-text-primary">{item.productName}</td>
                      <td className="py-2 pr-4 text-text-secondary">
                        {item.availableVariants.length > 1 ? (
                          <select
                            value={item.variantId ?? ''}
                            onChange={(e) => handleVariantChange(item.id, e.target.value)}
                            className="h-8 rounded-md border border-border bg-white px-2 text-sm"
                          >
                            {item.availableVariants.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name ?? v.sku}
                              </option>
                            ))}
                          </select>
                        ) : (
                          item.variantName ?? '-'
                        )}
                      </td>
                      <td className="py-2 pr-4 text-text-secondary">{item.sku}</td>
                      <td className="py-2 pr-4 text-right text-text-secondary">
                        ${item.unitPrice.toFixed(2)}
                      </td>
                      <td className="py-2 pr-4 text-center">
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItem(item.id, { quantity: parseInt(e.target.value, 10) || 1 })
                          }
                          className="mx-auto h-8 w-20 text-center"
                        />
                        {errors[`quantity-${item.id}`] && (
                          <FormError>{errors[`quantity-${item.id}`]}</FormError>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right font-medium text-text-primary">
                        ${item.totalPrice.toFixed(2)}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {errors.items && <FormError>{errors.items}</FormError>}
        </CardContent>
      </Card>

      {/* Shipping & Payment */}
      <Card>
        <CardHeader>
          <CardTitle>Shipping & Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Shipping Address</Label>
              <Input
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div>
              <Label>City</Label>
              <Input value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} />
            </div>
            <div>
              <Label>District</Label>
              <Input value={shippingDistrict} onChange={(e) => setShippingDistrict(e.target.value)} />
            </div>
            <div>
              <Label>Ward</Label>
              <Input value={shippingWard} onChange={(e) => setShippingWard(e.target.value)} />
            </div>
            <div>
              <Label>Payment Method</Label>
              <select
                value={paymentMethod ?? ''}
                onChange={(e) => setPaymentMethod((e.target.value as PaymentMethod) || null)}
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              >
                <option value="">Select payment method...</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Shipping Fee</Label>
              <Input
                type="number"
                min={0}
                value={shippingFee}
                onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Discount</Label>
              <Input
                type="number"
                min={0}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
              placeholder="Additional notes..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="space-y-2 pt-6">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Subtotal</span>
            <span className="font-medium text-text-primary">${totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Shipping</span>
            <span className="font-medium text-text-primary">${shippingFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Discount</span>
            <span className="font-medium text-text-primary">-${discountAmount.toFixed(2)}</span>
          </div>
          <div className="border-t border-border pt-2">
            <div className="flex justify-between text-lg font-semibold">
              <span className="text-text-primary">Total</span>
              <span className="text-primary">${finalAmount.toFixed(2)}</span>
            </div>
          </div>
          {errors.total && <FormError>{errors.total}</FormError>}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <Button
          type="submit"
          loading={createCustomerMutation.isPending || createOrderMutation.isPending}
          disabled={!canUpdate}
        >
          Create Order
        </Button>
      </div>
    </form>
  );
}
