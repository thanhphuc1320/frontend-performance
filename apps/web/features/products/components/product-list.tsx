'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Archive, ImageIcon } from 'lucide-react';
import { useProducts, useArchiveProduct } from '../queries';
import { useCapabilities } from '../../stores/queries';
import type { ProductFilters } from '../types';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Badge, type BadgeProps } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../../components/ui/table';
import { Card, CardContent } from '../../../components/ui/card';

interface ProductListProps {
  storeId: string;
}

const statusOptions: { label: string; value: ProductFilters['status'] }[] = [
  { label: 'All', value: undefined },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Archived', value: 'ARCHIVED' },
];

const sortOptions: { label: string; value: string }[] = [
  { label: 'Newest', value: 'createdAt:desc' },
  { label: 'Oldest', value: 'createdAt:asc' },
  { label: 'Name A–Z', value: 'name:asc' },
  { label: 'Name Z–A', value: 'name:desc' },
  { label: 'Price Low–High', value: 'basePrice:asc' },
  { label: 'Price High–Low', value: 'basePrice:desc' },
];

export function ProductList({ storeId }: ProductListProps) {
  const [filters, setFilters] = useState<ProductFilters>({
    page: 1,
    limit: 10,
  });
  const [searchInput, setSearchInput] = useState('');
  const { data, isLoading, error } = useProducts(storeId, filters);
  const archiveMutation = useArchiveProduct();
  const { data: capabilities } = useCapabilities();

  const canManage = capabilities?.permissions.includes('products.manage') ?? false;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput || undefined, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleStatusChange = useCallback((status: ProductFilters['status']) => {
    setFilters((prev) => ({ ...prev, status, page: 1 }));
  }, []);

  const handleSortChange = useCallback((sort: string) => {
    setFilters((prev) => ({ ...prev, sort, page: 1 }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const handleArchive = useCallback(
    (productId: string) => {
      if (!canManage) return;
      archiveMutation.mutate({ storeId, productId });
    },
    [canManage, archiveMutation, storeId]
  );

  const statusVariant = (status: string): BadgeProps['variant'] => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'DRAFT':
        return 'warning';
      case 'ARCHIVED':
        return 'secondary';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-10 w-full sm:w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-danger text-sm">
            {error instanceof Error ? error.message : 'Failed to load products'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const products = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search products..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <select
            aria-label="Filter by status"
            value={filters.status ?? ''}
            onChange={(e) => handleStatusChange((e.target.value as ProductFilters['status']) || undefined)}
            className="h-10 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          >
            {statusOptions.map((opt) => (
              <option key={opt.label} value={opt.value ?? ''}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort products"
            value={filters.sort ?? ''}
            onChange={(e) => handleSortChange(e.target.value)}
            className="h-10 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-text-secondary py-8">
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100">
                        <ImageIcon className="h-5 w-5 text-text-muted" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-text-primary">{product.name}</TableCell>
                    <TableCell className="text-text-secondary">—</TableCell>
                    <TableCell className="text-text-secondary">
                      ${product.basePrice.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(product.status)} size="sm">
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && product.status !== 'ARCHIVED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchive(product.id)}
                          loading={archiveMutation.isPending && archiveMutation.variables?.productId === product.id}
                          aria-label={`Archive ${product.name}`}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-muted">
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
