import { CustomerService } from './customer.service';
import type { OrderRepository } from '../infrastructure/order.repository';
import type { Customer } from '../domain/customer';
import type { Order } from '../domain/order';
import type { OrderStatus } from '../domain/order-status';
import { ApiError } from '../../http/api-error';
import { RepositoryError } from '../../persistence/repository-error';

describe('CustomerService', () => {
  function setup() {
    const now = new Date();

    const customer: Customer = {
      id: 'customer-1',
      storeId: 'store-1',
      userId: null,
      name: 'Test Customer',
      phone: '0901234567',
      email: null,
      address: null,
      city: null,
      district: null,
      ward: null,
      createdAt: now,
      updatedAt: now,
    };

    const order: Order = {
      id: 'order-1',
      storeId: 'store-1',
      customerId: 'customer-1',
      orderNumber: 'ORD-20240101-001',
      status: 'PENDING' as OrderStatus,
      totalAmount: 200,
      shippingFee: 10,
      discountAmount: 0,
      finalAmount: 210,
      shippingAddress: null,
      shippingCity: null,
      shippingDistrict: null,
      shippingWard: null,
      paymentStatus: 'PENDING',
      paymentMethod: null,
      notes: null,
      createdBy: 'user-1',
      createdAt: now,
      updatedAt: now,
    };

    type TestRepository = {
      createCustomer: jest.Mock;
      findCustomerById: jest.Mock;
      listCustomers: jest.Mock;
      listOrders: jest.Mock;
      deleteCustomer: jest.Mock;
    };

    const repository: TestRepository = {
      createCustomer: jest.fn(async () => customer),
      findCustomerById: jest.fn(async () => customer),
      listCustomers: jest.fn(async () => [customer]),
      listOrders: jest.fn(async () => ({ items: [order], total: 1, page: 1, limit: 5, totalPages: 1 })),
      deleteCustomer: jest.fn(async () => undefined),
    };

    const service = new CustomerService(repository as unknown as OrderRepository);
    return { customer, order, repository, service, now };
  }

  describe('create', () => {
    it('creates a customer with valid input', async () => {
      const { service, repository } = setup();
      const input = {
        storeId: 'store-1',
        name: 'Test Customer',
        phone: '0901234567',
      };

      const result = await service.create(input);
      expect(result).toMatchObject({ name: 'Test Customer', phone: '0901234567' });
      expect(repository.createCustomer).toHaveBeenCalledWith(input);
    });

    it('fails when name is empty', async () => {
      const { service } = setup();
      const input = {
        storeId: 'store-1',
        name: '',
        phone: '0901234567',
      };

      await expect(service.create(input)).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
      expect(setup().repository.createCustomer).not.toHaveBeenCalled();
    });

    it('fails when phone is empty', async () => {
      const { service } = setup();
      const input = {
        storeId: 'store-1',
        name: 'Test Customer',
        phone: '',
      };

      await expect(service.create(input)).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('fails when customer already exists', async () => {
      const { service, repository } = setup();
      repository.createCustomer.mockRejectedValueOnce(new RepositoryError('CONFLICT', 'Customer already exists'));

      const input = {
        storeId: 'store-1',
        name: 'Test Customer',
        phone: '0901234567',
      };

      await expect(service.create(input)).rejects.toMatchObject({
        status: 409,
        code: 'CONFLICT',
      });
    });
  });

  describe('list', () => {
    it('returns all customers', async () => {
      const { service, repository } = setup();
      const result = await service.list('store-1');
      expect(result).toHaveLength(1);
      expect(repository.listCustomers).toHaveBeenCalledWith('store-1');
    });

    it('filters customers by name', async () => {
      const { service, repository } = setup();
      repository.listCustomers.mockResolvedValueOnce([
        { ...setup().customer, name: 'Alice', phone: '0901111111' },
        { ...setup().customer, name: 'Bob', phone: '0902222222' },
      ]);

      const result = await service.list('store-1', 'Alice');
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('Alice');
    });

    it('filters customers by phone', async () => {
      const { service, repository } = setup();
      repository.listCustomers.mockResolvedValueOnce([
        { ...setup().customer, name: 'Alice', phone: '0901111111' },
        { ...setup().customer, name: 'Bob', phone: '0902222222' },
      ]);

      const result = await service.list('store-1', '090222');
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('Bob');
    });

    it('returns all customers when search is empty', async () => {
      const { service, repository } = setup();
      repository.listCustomers.mockResolvedValueOnce([
        { ...setup().customer, name: 'Alice' },
        { ...setup().customer, name: 'Bob' },
      ]);

      const result = await service.list('store-1', '  ');
      expect(result).toHaveLength(2);
    });
  });

  describe('findById', () => {
    it('returns customer with recent orders', async () => {
      const { service, repository, customer, order } = setup();
      const result = await service.findById('customer-1', 'store-1');
      expect(result).toEqual({ customer, recentOrders: [order] });
      expect(repository.findCustomerById).toHaveBeenCalledWith('customer-1', 'store-1');
      expect(repository.listOrders).toHaveBeenCalledWith('store-1', { customerId: 'customer-1', page: 1, limit: 5 });
    });

    it('returns null when customer not found', async () => {
      const { service, repository } = setup();
      repository.findCustomerById.mockResolvedValueOnce(null);
      const result = await service.findById('customer-2', 'store-1');
      expect(result).toBeNull();
      expect(repository.listOrders).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes a customer without orders', async () => {
      const { service, repository } = setup();
      await service.delete('customer-1', 'store-1');
      expect(repository.deleteCustomer).toHaveBeenCalledWith('customer-1', 'store-1');
    });

    it('fails when customer has orders', async () => {
      const { service, repository } = setup();
      repository.deleteCustomer.mockRejectedValueOnce(new RepositoryError('CONFLICT', 'Customer has orders'));

      await expect(service.delete('customer-1', 'store-1')).rejects.toMatchObject({
        status: 409,
        code: 'CONFLICT',
      });
    });

    it('fails when customer not found', async () => {
      const { service, repository } = setup();
      repository.deleteCustomer.mockRejectedValueOnce(new RepositoryError('NOT_FOUND', 'Customer not found'));

      await expect(service.delete('customer-1', 'store-1')).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });
    });
  });
});
