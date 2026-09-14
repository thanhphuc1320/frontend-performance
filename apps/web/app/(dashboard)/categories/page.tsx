'use client';

import { useRouter } from 'next/navigation';
import { useStores } from '../../../features/stores/queries';
import { useCategories } from '../../../features/products/queries';
import { CategoryTree } from '../../../features/products/components/category-tree';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';

export default function CategoriesPage() {
  const router = useRouter();
  const { data: stores, isLoading: storesLoading } = useStores();
  const storeId = stores?.[0]?.id;
  const { data: categories, isLoading: categoriesLoading } = useCategories(storeId ?? '', true);

  if (storesLoading || categoriesLoading) {
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
        <p className="text-text-secondary mb-4">Please select a store to manage categories</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Categories</h1>
          <p className="text-text-secondary mt-1">Manage your product categories</p>
        </div>
        <Button onClick={() => router.push('/categories/new')}>New Category</Button>
      </div>
      <CategoryTree categories={categories ?? []} />
    </div>
  );
}
