'use client';

import { useParams, useRouter } from 'next/navigation';
import { useStores } from '../../../../features/stores/queries';
import { useProduct } from '../../../../features/products/queries';
import { ProductForm } from '../../../../features/products/components/product-form';
import { Skeleton } from '../../../../components/ui/skeleton';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { data: stores, isLoading: storesLoading } = useStores();
  const storeId = stores?.[0]?.id;
  const { data: product, isLoading: productLoading } = useProduct(storeId ?? '', productId);

  if (storesLoading || productLoading) {
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
        <p className="text-text-secondary mb-4">Please select a store to edit products</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-text-secondary mb-4">Product not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Edit Product</h1>
        <p className="text-text-secondary mt-1">Update product details</p>
      </div>
      <ProductForm
        storeId={storeId}
        product={product}
        onSuccess={() => router.push('/products')}
        onCancel={() => router.push('/products')}
      />
    </div>
  );
}
