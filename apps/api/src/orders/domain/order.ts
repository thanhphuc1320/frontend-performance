import type { OrderStatus, PaymentStatus, PaymentMethod } from './order-status';
import type { Customer } from './customer';

export interface Order {
  id: string;
  storeId: string;
  customerId: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  finalAmount: number;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingDistrict: string | null;
  shippingWard: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface OrderDetail {
  order: Order;
  customer: Customer;
  items: OrderItem[];
  statusHistory: OrderStatusHistory[];
}
