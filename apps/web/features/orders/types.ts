export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'READY_TO_SHIP'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL' | 'REFUNDED';

export type PaymentMethod = 'COD' | 'BANK_TRANSFER' | 'MOMO' | 'VNPAY';

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
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
}

export interface Customer {
  id: string;
  storeId: string;
  userId: string | null;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  ward: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDetail {
  order: Order;
  customer: Customer;
  items: OrderItem[];
  statusHistory: OrderStatusHistory[];
}

export interface PaginatedOrders {
  items: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OrderFilters {
  status?: OrderStatus;
  customerId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface CreateOrderItemInput {
  productId: string;
  variantId?: string | null;
  productName: string;
  variantName?: string | null;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CreateOrderInput {
  customerId: string;
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  finalAmount: number;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingDistrict?: string | null;
  shippingWard?: string | null;
  paymentMethod?: PaymentMethod | null;
  notes?: string | null;
  items: CreateOrderItemInput[];
}

export interface CreateCustomerInput {
  userId?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  ward?: string | null;
}

export interface CustomerWithOrders {
  customer: Customer;
  recentOrders: Order[];
}
