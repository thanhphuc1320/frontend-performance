import { RepositoryError, mapConflict } from '../../persistence/repository-error';
import { PostgresDatabase } from '../../infrastructure/database.provider';
import type { Order, OrderItem, OrderStatusHistory, OrderDetail } from '../domain/order';
import type { Customer } from '../domain/customer';
import type { OrderStatus, PaymentStatus, PaymentMethod } from '../domain/order-status';

type Database = { query<T>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number | null }>; };

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
  storeId: string;
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
  createdBy: string;
  items: CreateOrderItemInput[];
}

export interface OrderFilters {
  status?: OrderStatus;
  customerId?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface PaginatedOrders {
  items: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type OrderRow = {
  id: string;
  store_id: string;
  customer_id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: string;
  shipping_fee: string;
  discount_amount: string;
  final_amount: string;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_district: string | null;
  shipping_ward: string | null;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  created_at: Date;
};

type OrderStatusHistoryRow = {
  id: string;
  order_id: string;
  status: OrderStatus;
  notes: string | null;
  created_by: string;
  created_at: Date;
};

type CustomerRow = {
  id: string;
  store_id: string;
  user_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  ward: string | null;
  created_at: Date;
  updated_at: Date;
};

type InventoryRow = {
  id: string;
  variant_id: string;
  quantity: number;
  reserved_quantity: number;
  updated_at: Date;
};

export class OrderRepository {
  constructor(private readonly db: PostgresDatabase) {}

  private async transaction<T>(work: (executor: Database) => Promise<T>): Promise<T> {
    const client = await this.db.acquire();
    await client.query('BEGIN');
    try {
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async generateOrderNumber(storeId: string, executor: Database = this.db): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `ORD-${dateStr}-`;
    const result = await executor.query<{ order_number: string }>(
      `SELECT order_number FROM orders WHERE store_id = $1 AND order_number LIKE $2 ORDER BY order_number DESC LIMIT 1`,
      [storeId, `${prefix}%`],
    );
    let nextNum = 1;
    if (result.rowCount && result.rowCount > 0) {
      const last = result.rows[0]!.order_number;
      const match = last.match(/-(\d{3})$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }

  async createOrder(input: CreateOrderInput): Promise<Order> {
    return this.transaction(async (executor) => {
      const orderNumber = await this.generateOrderNumber(input.storeId, executor);

      const orderResult = await executor.query<OrderRow>(
        `INSERT INTO orders (store_id, customer_id, order_number, status, total_amount, shipping_fee, discount_amount, final_amount, shipping_address, shipping_city, shipping_district, shipping_ward, payment_status, payment_method, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
        [
          input.storeId,
          input.customerId,
          orderNumber,
          'PENDING',
          input.totalAmount,
          input.shippingFee,
          input.discountAmount,
          input.finalAmount,
          input.shippingAddress ?? null,
          input.shippingCity ?? null,
          input.shippingDistrict ?? null,
          input.shippingWard ?? null,
          'PENDING',
          input.paymentMethod ?? null,
          input.notes ?? null,
          input.createdBy,
        ],
      );
      const order = this.mapOrder(orderResult.rows[0]!);

      for (const item of input.items) {
        await executor.query<OrderItemRow>(
          `INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_name, sku, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            order.id,
            item.productId,
            item.variantId ?? null,
            item.productName,
            item.variantName ?? null,
            item.sku,
            item.quantity,
            item.unitPrice,
            item.totalPrice,
          ],
        );
      }

      await executor.query<OrderStatusHistoryRow>(
        `INSERT INTO order_status_history (order_id, status, notes, created_by) VALUES ($1, $2, $3, $4)`,
        [order.id, 'PENDING', null, input.createdBy],
      );

      return order;
    });
  }

  async findOrderById(orderId: string, storeId: string): Promise<Order | null> {
    const result = await this.db.query<OrderRow>(
      `SELECT * FROM orders WHERE id = $1 AND store_id = $2`,
      [orderId, storeId],
    );
    if (result.rowCount === 0) return null;
    return this.mapOrder(result.rows[0]!);
  }

  async findOrderWithRelations(orderId: string, storeId: string): Promise<OrderDetail | null> {
    const order = await this.findOrderById(orderId, storeId);
    if (!order) return null;

    const [customerResult, itemsResult, historyResult] = await Promise.all([
      this.db.query<CustomerRow>(`SELECT * FROM customers WHERE id = $1`, [order.customerId]),
      this.db.query<OrderItemRow>(`SELECT * FROM order_items WHERE order_id = $1`, [orderId]),
      this.db.query<OrderStatusHistoryRow>(`SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY created_at DESC`, [orderId]),
    ]);

    const customer = customerResult.rows[0] ? this.mapCustomer(customerResult.rows[0]) : null;
    if (!customer) throw new RepositoryError('NOT_FOUND', 'Customer not found');

    return {
      order,
      customer,
      items: itemsResult.rows.map(this.mapOrderItem),
      statusHistory: historyResult.rows.map(this.mapOrderStatusHistory),
    };
  }

  async listOrders(storeId: string, filters: OrderFilters): Promise<PaginatedOrders> {
    const conditions: string[] = ['store_id = $1'];
    const values: unknown[] = [storeId];
    let idx = 2;

    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filters.status);
    }
    if (filters.customerId) {
      conditions.push(`customer_id = $${idx++}`);
      values.push(filters.customerId);
    }
    if (filters.search) {
      conditions.push(`order_number ILIKE $${idx++}`);
      values.push(`%${filters.search}%`);
    }

    const where = conditions.join(' AND ');

    const countResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM orders WHERE ${where}`,
      values,
    );
    const total = parseInt(countResult.rows[0]!.count, 10);

    const page = Math.max(1, filters.page);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const offset = (page - 1) * limit;

    const orderResult = await this.db.query<OrderRow>(
      `SELECT * FROM orders WHERE ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset],
    );

    const items = orderResult.rows.map(this.mapOrder);
    const totalPages = Math.ceil(total / limit);

    return { items, total, page, limit, totalPages };
  }

  async updateOrderStatus(orderId: string, storeId: string, status: OrderStatus, notes: string | null, createdBy: string): Promise<Order> {
    return this.transaction(async (executor) => {
      const result = await executor.query<OrderRow>(
        `UPDATE orders SET status = $3, updated_at = now() WHERE id = $1 AND store_id = $2 RETURNING *`,
        [orderId, storeId, status],
      );
      if (result.rowCount === 0) throw new RepositoryError('NOT_FOUND', 'Order not found');

      await executor.query(
        `INSERT INTO order_status_history (order_id, status, notes, created_by) VALUES ($1, $2, $3, $4)`,
        [orderId, status, notes ?? null, createdBy],
      );

      return this.mapOrder(result.rows[0]!);
    });
  }

  async cancelOrder(orderId: string, storeId: string, notes: string | null, createdBy: string): Promise<Order> {
    return this.updateOrderStatus(orderId, storeId, 'CANCELLED', notes, createdBy);
  }

  async createCustomer(input: { storeId: string; userId?: string | null; name: string; phone: string; email?: string | null; address?: string | null; city?: string | null; district?: string | null; ward?: string | null }): Promise<Customer> {
    try {
      const result = await this.db.query<CustomerRow>(
        `INSERT INTO customers (store_id, user_id, name, phone, email, address, city, district, ward)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          input.storeId,
          input.userId ?? null,
          input.name,
          input.phone,
          input.email ?? null,
          input.address ?? null,
          input.city ?? null,
          input.district ?? null,
          input.ward ?? null,
        ],
      );
      return this.mapCustomer(result.rows[0]!);
    } catch (error) {
      throw mapConflict(error, 'Customer already exists');
    }
  }

  async findCustomerById(customerId: string, storeId: string): Promise<Customer | null> {
    const result = await this.db.query<CustomerRow>(
      `SELECT * FROM customers WHERE id = $1 AND store_id = $2`,
      [customerId, storeId],
    );
    if (result.rowCount === 0) return null;
    return this.mapCustomer(result.rows[0]!);
  }

  async listCustomers(storeId: string): Promise<Customer[]> {
    const result = await this.db.query<CustomerRow>(
      `SELECT * FROM customers WHERE store_id = $1 ORDER BY created_at DESC`,
      [storeId],
    );
    return result.rows.map(this.mapCustomer);
  }

  async deleteCustomer(customerId: string, storeId: string): Promise<void> {
    const ordersResult = await this.db.query(
      `SELECT 1 FROM orders WHERE customer_id = $1 LIMIT 1`,
      [customerId],
    );
    if (ordersResult.rowCount !== null && ordersResult.rowCount > 0) {
      throw new RepositoryError('CONFLICT', 'Customer has orders');
    }

    const result = await this.db.query(
      `DELETE FROM customers WHERE id = $1 AND store_id = $2`,
      [customerId, storeId],
    );
    if (result.rowCount === 0) throw new RepositoryError('NOT_FOUND', 'Customer not found');
  }

  async deductInventory(variantId: string, quantity: number): Promise<void> {
    const result = await this.db.query<InventoryRow>(
      `UPDATE product_inventory SET quantity = quantity - $2, reserved_quantity = reserved_quantity + $2, updated_at = now()
       WHERE variant_id = $1 AND quantity >= $2
       RETURNING *`,
      [variantId, quantity],
    );
    if (result.rowCount === 0) {
      throw new RepositoryError('CONFLICT', 'Insufficient inventory');
    }
  }

  async returnInventory(variantId: string, quantity: number): Promise<void> {
    const result = await this.db.query<InventoryRow>(
      `UPDATE product_inventory SET quantity = quantity + $2, reserved_quantity = reserved_quantity - $2, updated_at = now()
       WHERE variant_id = $1 AND reserved_quantity >= $2
       RETURNING *`,
      [variantId, quantity],
    );
    if (result.rowCount === 0) {
      throw new RepositoryError('CONFLICT', 'Inventory return failed');
    }
  }

  private mapOrder(row: OrderRow): Order {
    return {
      id: row.id,
      storeId: row.store_id,
      customerId: row.customer_id,
      orderNumber: row.order_number,
      status: row.status,
      totalAmount: parseFloat(row.total_amount),
      shippingFee: parseFloat(row.shipping_fee),
      discountAmount: parseFloat(row.discount_amount),
      finalAmount: parseFloat(row.final_amount),
      shippingAddress: row.shipping_address,
      shippingCity: row.shipping_city,
      shippingDistrict: row.shipping_district,
      shippingWard: row.shipping_ward,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapOrderItem(row: OrderItemRow): OrderItem {
    return {
      id: row.id,
      orderId: row.order_id,
      productId: row.product_id,
      variantId: row.variant_id,
      productName: row.product_name,
      variantName: row.variant_name,
      sku: row.sku,
      quantity: row.quantity,
      unitPrice: parseFloat(row.unit_price),
      totalPrice: parseFloat(row.total_price),
    };
  }

  private mapOrderStatusHistory(row: OrderStatusHistoryRow): OrderStatusHistory {
    return {
      id: row.id,
      orderId: row.order_id,
      status: row.status,
      notes: row.notes,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }

  private mapCustomer(row: CustomerRow): Customer {
    return {
      id: row.id,
      storeId: row.store_id,
      userId: row.user_id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      city: row.city,
      district: row.district,
      ward: row.ward,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
