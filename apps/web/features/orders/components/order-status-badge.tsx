import React from 'react';
import { Badge, type BadgeProps } from '../../../components/ui/badge';
import type { OrderStatus } from '../types';

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

const statusConfig: Record<
  OrderStatus,
  { variant: BadgeProps['variant']; label: string; className?: string }
> = {
  PENDING: { variant: 'warning', label: 'Pending' },
  CONFIRMED: { variant: 'info', label: 'Confirmed' },
  PROCESSING: { variant: 'default', label: 'Processing', className: 'bg-purple-100 text-purple-700' },
  READY_TO_SHIP: { variant: 'default', label: 'Ready to Ship', className: 'bg-orange-100 text-orange-700' },
  SHIPPED: { variant: 'default', label: 'Shipped', className: 'bg-indigo-100 text-indigo-700' },
  DELIVERED: { variant: 'success', label: 'Delivered' },
  CANCELLED: { variant: 'danger', label: 'Cancelled' },
  REFUNDED: { variant: 'secondary', label: 'Refunded' },
};

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} size="sm" className={config.className}>
      {config.label}
    </Badge>
  );
}
