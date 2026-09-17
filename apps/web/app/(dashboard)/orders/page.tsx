'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStores } from '../../../features/stores/queries';
import { OrderList } from '../../../features/orders/components/order-list';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';

export default function OrdersPage() {
  const router = useRouter();
  const { data: stores, isLoading } = useStores();
  const storeId = stores?.[0]?.id;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!storeId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-text-secondary mb-4">Please select a store to manage orders</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Orders</h1>
          <p className="text-text-secondary mt-1">Manage your store orders</p>
        </div>
        <Button onClick={() => router.push('/orders/new')}>Create Order</Button>
      </div>
      <OrderList storeId={storeId} />
    </div>
  );
}
