'use client';

import { useRouter } from 'next/navigation';
import { useStores } from '../../../features/stores/queries';
import { ProductList } from '../../../features/products/components/product-list';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';

export default function ProductsPage() {
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
        <p className="text-text-secondary mb-4">Please select a store to manage products</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Products</h1>
          <p className="text-text-secondary mt-1">Manage your store products</p>
        </div>
        <Button onClick={() => router.push('/products/new')}>New Product</Button>
      </div>
      <ProductList storeId={storeId} />
    </div>
  );
}
