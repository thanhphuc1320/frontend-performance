'use client';

import { useRouter } from 'next/navigation';
import { useStores } from '../../../../features/stores/queries';
import { useCategories } from '../../../../features/products/queries';
import { CategoryForm } from '../../../../features/products/components/category-form';
import { Skeleton } from '../../../../components/ui/skeleton';

export default function NewCategoryPage() {
  const router = useRouter();
  const { data: stores, isLoading: storesLoading } = useStores();
  const storeId = stores?.[0]?.id;
  const { data: categories, isLoading: categoriesLoading } = useCategories(storeId ?? '');

  if (storesLoading || categoriesLoading) {
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
        <p className="text-text-secondary mb-4">Please select a store to create categories</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">New Category</h1>
        <p className="text-text-secondary mt-1">Create a new category</p>
      </div>
      <CategoryForm
        storeId={storeId}
        parentCategories={categories ?? []}
        onSuccess={() => router.push('/categories')}
        onCancel={() => router.push('/categories')}
      />
    </div>
  );
}
