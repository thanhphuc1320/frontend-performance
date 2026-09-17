'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Pencil, Trash2 } from 'lucide-react';
import { useCustomers, useDeleteCustomer } from '../queries';
import { useCapabilities } from '../../stores/queries';
import type { Customer } from '../types';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
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

interface CustomerListProps {
  storeId: string;
  onEdit?: (customer: Customer) => void;
}

export function CustomerList({ storeId, onEdit }: CustomerListProps) {
  const [searchInput, setSearchInput] = useState('');
  const { data: customers, isLoading, error } = useCustomers(storeId, searchInput || undefined);
  const deleteMutation = useDeleteCustomer();
  const { data: capabilities } = useCapabilities();

  const canManage = capabilities?.permissions.includes('orders.manage') ?? false;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      // Search is already triggered by the query hook when searchInput changes
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleDelete = useCallback(
    (customerId: string) => {
      if (!canManage) return;
      if (!window.confirm('Are you sure you want to delete this customer?')) return;
      deleteMutation.mutate({ storeId, customerId });
    },
    [canManage, deleteMutation, storeId]
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-10 w-full sm:w-64" />
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
            {error instanceof Error ? error.message : 'Failed to load customers'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const items = customers ?? [];

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search by name or phone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Order Count</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-text-secondary py-8">
                    No customers found
                  </TableCell>
                </TableRow>
              ) : (
                items.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium text-text-primary">{customer.name}</TableCell>
                    <TableCell className="text-text-secondary">{customer.phone}</TableCell>
                    <TableCell className="text-text-secondary">
                      {customer.email ?? '—'}
                    </TableCell>
                    <TableCell className="text-text-secondary">
                      {'orderCount' in customer && typeof (customer as Record<string, unknown>).orderCount === 'number'
                        ? String((customer as Record<string, unknown>).orderCount)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2">
                          {onEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(customer)}
                              aria-label={`Edit ${customer.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(customer.id)}
                            loading={deleteMutation.isPending && deleteMutation.variables?.customerId === customer.id}
                            aria-label={`Delete ${customer.name}`}
                          >
                            <Trash2 className="h-4 w-4 text-danger" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
