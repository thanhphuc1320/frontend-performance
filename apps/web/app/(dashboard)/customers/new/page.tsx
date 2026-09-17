'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStores } from '../../../../features/stores/queries';
import { CustomerForm } from '../../../../features/orders/components/customer-form';
import { Skeleton } from '../../../../components/ui/skeleton';

export default function NewCustomerPage() {
  const router = useRouter();
  const { data: stores, isLoading } = useStores();
  const storeId = stores?.[0]?.id;

  if (isLoading) {
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
        <p className="text-text-secondary mb-4">Please select a store to create customers</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">New Customer</h1>
        <p className="text-text-secondary mt-1">Create a new customer</p>
      </div>
      <CustomerForm
        storeId={storeId}
        onSuccess={() => router.push('/customers')}
      />
    </div>
  );
}
