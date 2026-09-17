'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useStores } from '../../../../features/stores/queries';
import { OrderDetail } from '../../../../features/orders/components/order-detail';
import { Skeleton } from '../../../../components/ui/skeleton';

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const { data: stores, isLoading: storesLoading } = useStores();
  const storeId = stores?.[0]?.id;

  if (storesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!storeId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-text-secondary mb-4">Please select a store to view orders</p>
      </div>
    );
  }

  if (!orderId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-text-secondary mb-4">Order not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OrderDetail storeId={storeId} orderId={orderId} />
    </div>
  );
}
