import { Injectable, Inject } from '@nestjs/common';
import { ORDER_REPOSITORY } from './order.tokens';
import type { OrderRepository, CreateOrderInput, OrderFilters } from '../infrastructure/order.repository';
import type { Order, OrderDetail } from '../domain/order';
import type { OrderStatus } from '../domain/order-status';
import { isValidStatusTransition } from '../domain/order-status';
import { ApiError } from '../../http/api-error';
import { RepositoryError } from '../../persistence/repository-error';

@Injectable()
export class OrderService {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly repository: OrderRepository,
  ) {}

  async createOrder(input: CreateOrderInput): Promise<Order> {
    if (!input.storeId || input.storeId.trim().length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Store ID is required');
    }
    if (!input.customerId || input.customerId.trim().length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Customer ID is required');
    }
    if (!input.createdBy || input.createdBy.trim().length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Created by is required');
    }
    if (!input.items || input.items.length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Order must have at least one item');
    }

    let calculatedTotal = 0;
    for (const item of input.items) {
      if (!item.productId || item.productId.trim().length === 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Product ID is required for all items');
      }
      if (!item.productName || item.productName.trim().length === 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Product name is required for all items');
      }
      if (!item.sku || item.sku.trim().length === 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'SKU is required for all items');
      }
      if (item.quantity <= 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Quantity must be greater than 0');
      }
      if (item.unitPrice < 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Unit price cannot be negative');
      }
      if (item.totalPrice < 0) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Total price cannot be negative');
      }
      calculatedTotal += item.totalPrice;
    }

    const expectedFinal = input.totalAmount + input.shippingFee - input.discountAmount;
    if (Math.abs(calculatedTotal - input.totalAmount) > 0.001) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Total amount does not match sum of item prices');
    }
    if (Math.abs(expectedFinal - input.finalAmount) > 0.001) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Final amount does not match total + shipping - discount');
    }

    try {
      return await this.repository.createOrder(input);
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw new ApiError(error.code === 'CONFLICT' ? 409 : 400, error.code, error.message);
      }
      throw error;
    }
  }

  async findById(orderId: string, storeId: string): Promise<OrderDetail | null> {
    return this.repository.findOrderWithRelations(orderId, storeId);
  }

  async listOrders(storeId: string, filters: OrderFilters) {
    return this.repository.listOrders(storeId, filters);
  }

  async updateStatus(
    orderId: string,
    storeId: string,
    status: OrderStatus,
    notes: string | null,
    createdBy: string,
  ): Promise<Order> {
    const order = await this.repository.findOrderById(orderId, storeId);
    if (!order) {
      throw new ApiError(404, 'NOT_FOUND', 'Order not found');
    }
    if (!isValidStatusTransition(order.status, status)) {
      throw new ApiError(400, 'INVALID_STATUS_TRANSITION', `Cannot transition from ${order.status} to ${status}`);
    }

    try {
      return await this.repository.updateOrderStatus(orderId, storeId, status, notes, createdBy);
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw new ApiError(error.code === 'CONFLICT' ? 409 : 400, error.code, error.message);
      }
      throw error;
    }
  }

  async cancelOrder(
    orderId: string,
    storeId: string,
    notes: string | null,
    createdBy: string,
  ): Promise<Order> {
    const order = await this.repository.findOrderById(orderId, storeId);
    if (!order) {
      throw new ApiError(404, 'NOT_FOUND', 'Order not found');
    }
    if (!isValidStatusTransition(order.status, 'CANCELLED')) {
      throw new ApiError(400, 'INVALID_STATUS_TRANSITION', `Cannot cancel order in status ${order.status}`);
    }

    try {
      return await this.repository.cancelOrder(orderId, storeId, notes, createdBy);
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw new ApiError(error.code === 'CONFLICT' ? 409 : 400, error.code, error.message);
      }
      throw error;
    }
  }
}
