'use client';

import React from 'react';
import { Store, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import type { Store as StoreType } from '../api';

interface StoreSwitcherProps {
  stores: StoreType[];
  loading?: boolean;
  error?: string | null;
  onSelect: (storeId: string) => void | Promise<void>;
}

export function StoreSwitcher({ stores, loading, error, onSelect }: StoreSwitcherProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">Loading stores...</p>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-danger text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (stores.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <Store className="h-8 w-8 text-text-muted mx-auto mb-2" />
          <p className="text-text-secondary text-sm">No stores available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {stores.map((store) => (
        <button
          key={store.id}
          onClick={() => void onSelect(store.id)}
          className="flex w-full items-center gap-4 rounded-lg border border-border bg-white p-4 text-left transition-colors hover:border-primary hover:shadow-sm"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-text-primary">{store.name}</h3>
            <p className="text-sm text-text-muted">Click to select this store</p>
          </div>
          <ChevronRight className="h-5 w-5 text-text-muted" />
        </button>
      ))}
    </div>
  );
}
