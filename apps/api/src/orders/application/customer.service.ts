import { Injectable, Inject } from '@nestjs/common';
import { ORDER_REPOSITORY } from './order.tokens';
import type { OrderRepository } from '../infrastructure/order.repository';
import type { Customer } from '../domain/customer';
import { validateCustomerName, validatePhone } from '../domain/customer';
import { ApiError } from '../../http/api-error';
import { RepositoryError } from '../../persistence/repository-error';

export interface CreateCustomerInput {
  storeId: string;
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
  recentOrders: import('../domain/order').Order[];
}

@Injectable()
export class CustomerService {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly repository: OrderRepository,
  ) {}

  async create(input: CreateCustomerInput): Promise<Customer> {
    const nameError = validateCustomerName(input.name);
    if (nameError) {
      throw new ApiError(400, 'VALIDATION_ERROR', nameError);
    }
    const phoneError = validatePhone(input.phone);
    if (phoneError) {
      throw new ApiError(400, 'VALIDATION_ERROR', phoneError);
    }

    try {
      return await this.repository.createCustomer(input);
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw new ApiError(error.code === 'CONFLICT' ? 409 : 400, error.code, error.message);
      }
      throw error;
    }
  }

  async list(storeId: string, search?: string): Promise<Customer[]> {
    const customers = await this.repository.listCustomers(storeId);
    if (!search || search.trim().length === 0) {
      return customers;
    }
    const term = search.trim().toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(term) || c.phone.toLowerCase().includes(term),
    );
  }

  async findById(customerId: string, storeId: string): Promise<CustomerWithOrders | null> {
    const customer = await this.repository.findCustomerById(customerId, storeId);
    if (!customer) return null;

    const { items: recentOrders } = await this.repository.listOrders(storeId, {
      customerId,
      page: 1,
      limit: 5,
    });

    return { customer, recentOrders };
  }

  async delete(customerId: string, storeId: string): Promise<void> {
    try {
      await this.repository.deleteCustomer(customerId, storeId);
    } catch (error) {
      if (error instanceof RepositoryError) {
        if (error.code === 'NOT_FOUND') {
          throw new ApiError(404, 'NOT_FOUND', error.message);
        }
        throw new ApiError(error.code === 'CONFLICT' ? 409 : 400, error.code, error.message);
      }
      throw error;
    }
  }
}
