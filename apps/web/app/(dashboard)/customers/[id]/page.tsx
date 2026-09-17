'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useStores } from '../../../../features/stores/queries';
import { useCustomer } from '../../../../features/orders/queries';
import { useOrders } from '../../../../features/orders/queries';
import { OrderStatusBadge } from '../../../../features/orders/components/order-status-badge';
import { Skeleton } from '../../../../components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.id as string;
  const { data: stores, isLoading: storesLoading } = useStores();
  const storeId = stores?.[0]?.id;

  const { data: customerData, isLoading: customerLoading } = useCustomer(storeId ?? '', customerId ?? '');
  const customer = customerData?.customer;
  const { data: ordersData, isLoading: ordersLoading } = useOrders(storeId ?? '', { customerId });

  if (storesLoading || customerLoading || ordersLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!storeId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-text-secondary mb-4">Please select a store to view customers</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-text-secondary mb-4">Customer not found</p>
      </div>
    );
  }

  const orders = ordersData?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">{customer.name}</h1>
        <p className="text-text-secondary mt-1">Customer details</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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

        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-secondary">No orders found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-6 py-3 text-left font-medium text-text-secondary">Order #</th>
                      <th className="px-6 py-3 text-left font-medium text-text-secondary">Status</th>
                      <th className="px-6 py-3 text-right font-medium text-text-secondary">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-border last:border-0">
                        <td className="px-6 py-3 text-text-primary">{order.orderNumber}</td>
                        <td className="px-6 py-3">
                          <OrderStatusBadge status={order.status} />
                        </td>
                        <td className="px-6 py-3 text-right text-text-secondary">
                          ${order.finalAmount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
