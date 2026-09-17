import { OrderService } from './order.service';
import type { OrderRepository, CreateOrderInput, OrderFilters } from '../infrastructure/order.repository';
import type { Order, OrderDetail, OrderItem, OrderStatusHistory } from '../domain/order';
import type { Customer } from '../domain/customer';
import type { OrderStatus } from '../domain/order-status';


describe('OrderService', () => {
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
      status: 'PENDING',
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

    const orderItem: OrderItem = {
      id: 'item-1',
      orderId: 'order-1',
      productId: 'product-1',
      variantId: null,
      productName: 'Test Product',
      variantName: null,
      sku: 'SKU-001',
      quantity: 2,
      unitPrice: 100,
      totalPrice: 200,
    };

    const statusHistory: OrderStatusHistory = {
      id: 'history-1',
      orderId: 'order-1',
      status: 'PENDING',
      notes: null,
      createdBy: 'user-1',
      createdAt: now,
    };

    const orderDetail: OrderDetail = {
      order,
      customer,
      items: [orderItem],
      statusHistory: [statusHistory],
    };

    const paginated = {
      items: [order],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };

    type TestRepository = {
      createOrder: jest.Mock;
      findOrderById: jest.Mock;
      findOrderWithRelations: jest.Mock;
      listOrders: jest.Mock;
      updateOrderStatus: jest.Mock;
      cancelOrder: jest.Mock;
    };

    const repository: TestRepository = {
      createOrder: jest.fn(async () => order),
      findOrderById: jest.fn(async () => order),
      findOrderWithRelations: jest.fn(async () => orderDetail),
      listOrders: jest.fn(async () => paginated),
      updateOrderStatus: jest.fn(async () => ({ ...order, status: 'CONFIRMED' as OrderStatus })),
      cancelOrder: jest.fn(async () => ({ ...order, status: 'CANCELLED' as OrderStatus })),
    };

    const service = new OrderService(repository as unknown as OrderRepository);
    return { order, orderDetail, paginated, repository, service, now };
  }

  function createValidInput(): CreateOrderInput {
    return {
      storeId: 'store-1',
      customerId: 'customer-1',
      totalAmount: 200,
      shippingFee: 10,
      discountAmount: 0,
      finalAmount: 210,
      createdBy: 'user-1',
      items: [
        {
          productId: 'product-1',
          productName: 'Test Product',
          sku: 'SKU-001',
          quantity: 2,
          unitPrice: 100,
          totalPrice: 200,
        },
      ],
    };
  }

  describe('createOrder', () => {
    it('creates an order with valid input', async () => {
      const { service, repository } = setup();
      const input = createValidInput();

      const result = await service.createOrder(input);
      expect(result).toMatchObject({ status: 'PENDING', totalAmount: 200 });
      expect(repository.createOrder).toHaveBeenCalledWith(input);
    });

    it('fails when items are empty', async () => {
      const { service } = setup();
      const input = { ...createValidInput(), items: [] };

      await expect(service.createOrder(input)).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('fails when productId is missing', async () => {
      const { service } = setup();
      const input = createValidInput();
      input.items[0]!.productId = '';

      await expect(service.createOrder(input)).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('fails when productName is missing', async () => {
      const { service } = setup();
      const input = createValidInput();
      input.items[0]!.productName = '';

      await expect(service.createOrder(input)).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('fails when sku is missing', async () => {
      const { service } = setup();
      const input = createValidInput();
      input.items[0]!.sku = '';

      await expect(service.createOrder(input)).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('fails when quantity is 0 or negative', async () => {
      const { service } = setup();
      const input = createValidInput();
      input.items[0]!.quantity = 0;

      await expect(service.createOrder(input)).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('fails when unitPrice is negative', async () => {
      const { service } = setup();
      const input = createValidInput();
      input.items[0]!.unitPrice = -1;

      await expect(service.createOrder(input)).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('fails when totalPrice is negative', async () => {
      const { service } = setup();
      const input = createValidInput();
      input.items[0]!.totalPrice = -1;

      await expect(service.createOrder(input)).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('fails when totalAmount does not match sum of items', async () => {
      const { service } = setup();
      const input = createValidInput();
      input.totalAmount = 999;

      await expect(service.createOrder(input)).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('fails when finalAmount does not match total + shipping - discount', async () => {
      const { service } = setup();
      const input = createValidInput();
      input.finalAmount = 999;

      await expect(service.createOrder(input)).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('fails when storeId is missing', async () => {
      const { service } = setup();
      const input = { ...createValidInput(), storeId: '' };

      await expect(service.createOrder(input)).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('fails when customerId is missing', async () => {
      const { service } = setup();
      const input = { ...createValidInput(), customerId: '' };

      await expect(service.createOrder(input)).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('fails when createdBy is missing', async () => {
      const { service } = setup();
      const input = { ...createValidInput(), createdBy: '' };

      await expect(service.createOrder(input)).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('findById', () => {
    it('returns order with relations when found', async () => {
      const { service, repository, orderDetail } = setup();
      const result = await service.findById('order-1', 'store-1');
      expect(result).toEqual(orderDetail);
      expect(repository.findOrderWithRelations).toHaveBeenCalledWith('order-1', 'store-1');
    });

    it('returns null when order not found', async () => {
      const { service, repository } = setup();
      repository.findOrderWithRelations.mockResolvedValueOnce(null);
      const result = await service.findById('order-2', 'store-1');
      expect(result).toBeNull();
    });
  });

  describe('listOrders', () => {
    it('returns paginated results', async () => {
      const { service, repository, paginated } = setup();
      const filters: OrderFilters = { page: 1, limit: 20 };
      const result = await service.listOrders('store-1', filters);
      expect(result).toEqual(paginated);
      expect(repository.listOrders).toHaveBeenCalledWith('store-1', filters);
    });
  });

  describe('updateStatus', () => {
    it('updates status with valid transition', async () => {
      const { service, repository } = setup();
      const result = await service.updateStatus('order-1', 'store-1', 'CONFIRMED', null, 'user-1');
      expect(result.status).toBe('CONFIRMED');
      expect(repository.updateOrderStatus).toHaveBeenCalledWith('order-1', 'store-1', 'CONFIRMED', null, 'user-1');
    });

    it('fails with invalid transition', async () => {
      const { service, repository } = setup();
      repository.findOrderById.mockResolvedValueOnce({
        ...setup().order,
        status: 'SHIPPED' as OrderStatus,
      });

      await expect(service.updateStatus('order-1', 'store-1', 'PENDING', null, 'user-1')).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_STATUS_TRANSITION',
      });
      expect(repository.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('fails when order not found', async () => {
      const { service, repository } = setup();
      repository.findOrderById.mockResolvedValueOnce(null);

      await expect(service.updateStatus('order-1', 'store-1', 'CONFIRMED', null, 'user-1')).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('cancelOrder', () => {
    it('cancels an order with valid transition', async () => {
      const { service, repository } = setup();
      const result = await service.cancelOrder('order-1', 'store-1', 'Customer requested', 'user-1');
      expect(result.status).toBe('CANCELLED');
      expect(repository.cancelOrder).toHaveBeenCalledWith('order-1', 'store-1', 'Customer requested', 'user-1');
    });

    it('fails when order not found', async () => {
      const { service, repository } = setup();
      repository.findOrderById.mockResolvedValueOnce(null);

      await expect(service.cancelOrder('order-1', 'store-1', null, 'user-1')).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });
    });

    it('fails when order cannot be cancelled', async () => {
      const { service, repository } = setup();
      repository.findOrderById.mockResolvedValueOnce({
        ...setup().order,
        status: 'DELIVERED' as OrderStatus,
      });

      await expect(service.cancelOrder('order-1', 'store-1', null, 'user-1')).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_STATUS_TRANSITION',
      });
      expect(repository.cancelOrder).not.toHaveBeenCalled();
    });
  });
});
