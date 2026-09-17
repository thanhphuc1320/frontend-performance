'use client';

import React from 'react';
import { useStores } from '../../../features/stores/queries';
import { CustomerList } from '../../../features/orders/components/customer-list';
import { Skeleton } from '../../../components/ui/skeleton';

export default function CustomersPage() {
  const { data: stores, isLoading } = useStores();
  const storeId = stores?.[0]?.id;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!storeId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-text-secondary mb-4">Please select a store to manage customers</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Customers</h1>
          <p className="text-text-secondary mt-1">Manage your customers</p>
        </div>
      </div>
      <CustomerList storeId={storeId} />
    </div>
  );
}
