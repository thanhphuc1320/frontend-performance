'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useOrders, useUpdateOrderStatus } from '../queries';
import { useCapabilities } from '../../stores/queries';
import type { OrderFilters, OrderStatus } from '../types';
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
import { OrderStatusBadge } from './order-status-badge';

interface OrderListProps {
  storeId: string;
}

const statusOptions: { label: string; value: OrderFilters['status'] }[] = [
  { label: 'All', value: undefined },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Ready to Ship', value: 'READY_TO_SHIP' },
  { label: 'Shipped', value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Refunded', value: 'REFUNDED' },
];

const updateStatusOptions: { label: string; value: OrderStatus }[] = [
  { label: 'Pending', value: 'PENDING' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Ready to Ship', value: 'READY_TO_SHIP' },
  { label: 'Shipped', value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Refunded', value: 'REFUNDED' },
];

export function OrderList({ storeId }: OrderListProps) {
  const [filters, setFilters] = useState<OrderFilters>({
    page: 1,
    limit: 10,
  });
  const [searchInput, setSearchInput] = useState('');
  const { data, isLoading, error } = useOrders(storeId, filters);
  const updateStatusMutation = useUpdateOrderStatus();
  const { data: capabilities } = useCapabilities();

  const canUpdate = capabilities?.permissions.includes('orders.update') ?? false;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput || undefined, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleStatusChange = useCallback((status: OrderFilters['status']) => {
    setFilters((prev) => ({ ...prev, status, page: 1 }));
  }, []);

  const handleDateFromChange = useCallback((dateFrom: string) => {
    setFilters((prev) => ({ ...prev, dateFrom: dateFrom || undefined, page: 1 }));
  }, []);

  const handleDateToChange = useCallback((dateTo: string) => {
    setFilters((prev) => ({ ...prev, dateTo: dateTo || undefined, page: 1 }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const handleUpdateStatus = useCallback(
    (orderId: string, status: OrderStatus) => {
      if (!canUpdate) return;
      updateStatusMutation.mutate({ storeId, orderId, data: { status } });
    },
    [canUpdate, updateStatusMutation, storeId]
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-10 w-full sm:w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-40" />
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
            {error instanceof Error ? error.message : 'Failed to load orders'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const orders = data?.items ?? [];
  const pagination = data
    ? { page: data.page, limit: data.limit, total: data.total, totalPages: data.totalPages }
    : undefined;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search by order number..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Filter by status"
            value={filters.status ?? ''}
            onChange={(e) => handleStatusChange((e.target.value as OrderFilters['status']) || undefined)}
            className="h-10 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          >
            {statusOptions.map((opt) => (
              <option key={opt.label} value={opt.value ?? ''}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            aria-label="Date from"
            value={filters.dateFrom ?? ''}
            onChange={(e) => handleDateFromChange(e.target.value)}
            className="h-10 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          />
          <input
            type="date"
            aria-label="Date to"
            value={filters.dateTo ?? ''}
            onChange={(e) => handleDateToChange(e.target.value)}
            className="h-10 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-text-secondary py-8">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium text-text-primary">{order.orderNumber}</TableCell>
                    <TableCell className="text-text-secondary">{order.customerId}</TableCell>
                    <TableCell className="text-text-secondary">
                      ${order.finalAmount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-text-secondary">{formatDate(order.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {canUpdate && (
                        <select
                          aria-label={`Update status for order ${order.orderNumber}`}
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value as OrderStatus)}
                          disabled={updateStatusMutation.isPending && updateStatusMutation.variables?.orderId === order.id}
                          className="h-8 rounded-md border border-border bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:opacity-50"
                        >
                          {updateStatusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
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
