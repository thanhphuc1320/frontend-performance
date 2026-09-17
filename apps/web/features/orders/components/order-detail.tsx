'use client';

import React, { useState, useCallback } from 'react';
import { useOrder, useUpdateOrderStatus, useCancelOrder } from '../queries';
import { useCapabilities } from '../../stores/queries';
import type { OrderStatus } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { OrderStatusBadge } from './order-status-badge';
import { Alert } from '../../../components/ui/alert';

interface OrderDetailProps {
  storeId: string;
  orderId: string;
}

const statusOptions: { label: string; value: OrderStatus }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Ready to Ship', value: 'READY_TO_SHIP' },
  { label: 'Shipped', value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Refunded', value: 'REFUNDED' },
];

const cancelableStatuses: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING'];

export function OrderDetail({ storeId, orderId }: OrderDetailProps) {
  const { data, isLoading, error } = useOrder(storeId, orderId);
  const updateStatusMutation = useUpdateOrderStatus();
  const cancelOrderMutation = useCancelOrder();
  const { data: capabilities } = useCapabilities();
  const [cancelNotes, setCancelNotes] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const canManage = capabilities?.permissions.includes('orders.manage') ?? false;

  const handleStatusChange = useCallback(
    (status: OrderStatus) => {
      if (!canManage) return;
      updateStatusMutation.mutate({ storeId, orderId, data: { status } });
    },
    [canManage, updateStatusMutation, storeId, orderId]
  );

  const handleCancel = useCallback(() => {
    if (!canManage) return;
    cancelOrderMutation.mutate(
      { storeId, orderId, notes: cancelNotes || null },
      {
        onSuccess: () => setShowCancelConfirm(false),
      }
    );
  }, [canManage, cancelOrderMutation, storeId, orderId, cancelNotes]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <Alert variant="danger">
            {error instanceof Error ? error.message : 'Failed to load order'}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-text-secondary">Order not found</p>
        </CardContent>
      </Card>
    );
  }

  const { order, customer, items, statusHistory } = data;
  const canCancel = canManage && cancelableStatuses.includes(order.status);

  return (
    <div className="space-y-6">
      {/* Order Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-text-primary">{order.orderNumber}</h1>
                <OrderStatusBadge status={order.status} />
              </div>
              <p className="mt-1 text-sm text-text-muted">Created on {formatDate(order.createdAt)}</p>
            </div>

            {canManage && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Update order status"
                  value={order.status}
                  onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
                  disabled={updateStatusMutation.isPending}
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:opacity-50"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {canCancel && (
                  <>
                    {!showCancelConfirm ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowCancelConfirm(true)}
                      >
                        Cancel Order
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Cancellation reason..."
                          value={cancelNotes}
                          onChange={(e) => setCancelNotes(e.target.value)}
                          className="h-10 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleCancel}
                          loading={cancelOrderMutation.isPending}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setShowCancelConfirm(false);
                            setCancelNotes('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Order Info */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium text-text-primary">{customer.name}</p>
            <p className="text-sm text-text-secondary">{customer.phone}</p>
            {customer.email && <p className="text-sm text-text-secondary">{customer.email}</p>}
            {customer.address && (
              <div className="mt-3 text-sm text-text-secondary">
                <p>{customer.address}</p>
                <p>
                  {[customer.ward, customer.district, customer.city]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shipping Info */}
        <Card>
          <CardHeader>
            <CardTitle>Shipping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.shippingAddress ? (
              <>
                <p className="text-sm text-text-primary">{order.shippingAddress}</p>
                <p className="text-sm text-text-secondary">
                  {[order.shippingWard, order.shippingDistrict, order.shippingCity]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </>
            ) : (
              <p className="text-sm text-text-muted">No shipping address</p>
            )}
            <div className="mt-2 border-t border-border pt-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Shipping Fee</span>
                <span className="font-medium text-text-primary">${order.shippingFee.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Method</span>
              <span className="font-medium text-text-primary">
                {order.paymentMethod ?? 'Not specified'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Status</span>
              <span className="font-medium text-text-primary">{order.paymentStatus}</span>
            </div>
            {order.notes && (
              <div className="mt-2 border-t border-border pt-2">
                <p className="text-sm text-text-muted">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left font-medium text-text-secondary">Product</th>
                  <th className="px-6 py-3 text-left font-medium text-text-secondary">Variant</th>
                  <th className="px-6 py-3 text-left font-medium text-text-secondary">SKU</th>
                  <th className="px-6 py-3 text-right font-medium text-text-secondary">Unit Price</th>
                  <th className="px-6 py-3 text-center font-medium text-text-secondary">Quantity</th>
                  <th className="px-6 py-3 text-right font-medium text-text-secondary">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-3 text-text-primary">{item.productName}</td>
                    <td className="px-6 py-3 text-text-secondary">{item.variantName ?? '-'}</td>
                    <td className="px-6 py-3 text-text-secondary">{item.sku}</td>
                    <td className="px-6 py-3 text-right text-text-secondary">
                      ${item.unitPrice.toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-center text-text-secondary">{item.quantity}</td>
                    <td className="px-6 py-3 text-right font-medium text-text-primary">
                      ${item.totalPrice.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-gray-50">
                  <td colSpan={4} className="px-6 py-3"></td>
                  <td className="px-6 py-3 text-right font-medium text-text-secondary">Subtotal</td>
                  <td className="px-6 py-3 text-right font-medium text-text-primary">
                    ${order.totalAmount.toFixed(2)}
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td colSpan={4} className="px-6 py-3"></td>
                  <td className="px-6 py-3 text-right font-medium text-text-secondary">Shipping</td>
                  <td className="px-6 py-3 text-right font-medium text-text-primary">
                    ${order.shippingFee.toFixed(2)}
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td colSpan={4} className="px-6 py-3"></td>
                  <td className="px-6 py-3 text-right font-medium text-text-secondary">Discount</td>
                  <td className="px-6 py-3 text-right font-medium text-text-primary">
                    -${order.discountAmount.toFixed(2)}
                  </td>
                </tr>
                <tr className="border-t border-border bg-gray-50">
                  <td colSpan={4} className="px-6 py-3"></td>
                  <td className="px-6 py-3 text-right font-semibold text-text-primary">Total</td>
                  <td className="px-6 py-3 text-right font-semibold text-primary">
                    ${order.finalAmount.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Status Timeline */}
      {statusHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Status History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {statusHistory.map((history, index) => (
                <div key={history.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-3 rounded-full bg-primary"></div>
                    {index < statusHistory.length - 1 && (
                      <div className="mt-1 h-full w-0.5 bg-border"></div>
                    )}
                  </div>
                  <div className="pb-4">
                    <div className="flex items-center gap-2">
                      <OrderStatusBadge status={history.status} />
                      <span className="text-xs text-text-muted">{formatDate(history.createdAt)}</span>
                    </div>
                    {history.notes && (
                      <p className="mt-1 text-sm text-text-secondary">{history.notes}</p>
                    )}
                    <p className="text-xs text-text-muted">by {history.createdBy}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
