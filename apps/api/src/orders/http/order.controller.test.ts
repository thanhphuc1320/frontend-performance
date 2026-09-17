import { OrderController } from './order.controller';
import type { OrderService } from '../application/order.service';
import type { Order, OrderDetail } from '../domain/order';
import type { OrderStatus } from '../domain/order-status';
import type { PaginatedOrders } from '../infrastructure/order.repository';

describe('OrderController', () => {
  function makeDependencies() {
    const order: Order = {
      id: 'order-1',
      storeId: 'store-1',
      customerId: 'customer-1',
      orderNumber: 'ORD-20240101-001',
      status: 'PENDING',
      totalAmount: 100,
      shippingFee: 10,
      discountAmount: 0,
      finalAmount: 110,
      shippingAddress: null,
      shippingCity: null,
      shippingDistrict: null,
      shippingWard: null,
      paymentStatus: 'PENDING',
      paymentMethod: null,
      notes: null,
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const orderDetail: OrderDetail = {
      order,
      customer: {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      items: [],
      statusHistory: [],
    };

    const paginated: PaginatedOrders = {
      items: [order],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };

    const service = {
      listOrders: jest.fn(async () => paginated),
      createOrder: jest.fn(async () => order),
      findById: jest.fn(async () => orderDetail),
      updateStatus: jest.fn(async () => ({ ...order, status: 'CONFIRMED' as OrderStatus })),
      updateOrder: jest.fn(async () => order),
      cancelOrder: jest.fn(async () => ({ ...order, status: 'CANCELLED' as OrderStatus })),
    };

    return { order, orderDetail, paginated, service };
  }

  function makeRequest(overrides: Record<string, unknown> = {}) {
    return { userId: 'user-1', ...overrides };
  }

  function makeController(service: ReturnType<typeof makeDependencies>['service']) {
    return new OrderController(service as unknown as OrderService);
  }

  it('lists orders', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.list('store-1', { page: 1, limit: 20 });

    expect(result).toEqual({ data: deps.paginated });
    expect(deps.service.listOrders).toHaveBeenCalledWith('store-1', { page: 1, limit: 20 });
  });

  it('creates an order', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);
    const body = {
      customerId: 'customer-1',
      totalAmount: 100,
      shippingFee: 10,
      discountAmount: 0,
      finalAmount: 110,
      items: [{ productId: 'product-1', productName: 'Test Product', sku: 'SKU-001', quantity: 1, unitPrice: 100, totalPrice: 100 }],
    };

    const result = await controller.create('store-1', body as never, makeRequest() as never);

    expect(result).toEqual({ data: deps.order });
    expect(deps.service.createOrder).toHaveBeenCalledWith(expect.objectContaining({ storeId: 'store-1', createdBy: 'user-1', ...body }));
  });

  it('throws when creating without userId', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    await expect(controller.create('store-1', {} as never, makeRequest({ userId: undefined }) as never)).rejects.toThrow();
  });

  it('gets order detail', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.get('store-1', 'order-1');

    expect(result).toEqual({ data: deps.orderDetail });
    expect(deps.service.findById).toHaveBeenCalledWith('order-1', 'store-1');
  });

  it('updates order status', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.updateStatus('store-1', 'order-1', { status: 'CONFIRMED' as OrderStatus }, makeRequest() as never);

    expect(result.data).toMatchObject({ status: 'CONFIRMED' });
    expect(deps.service.updateStatus).toHaveBeenCalledWith('order-1', 'store-1', 'CONFIRMED', null, 'user-1');
  });

  it('updates order status with notes', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    await controller.updateStatus('store-1', 'order-1', { status: 'CONFIRMED' as OrderStatus, notes: 'Confirmed by customer' }, makeRequest() as never);

    expect(deps.service.updateStatus).toHaveBeenCalledWith('order-1', 'store-1', 'CONFIRMED', 'Confirmed by customer', 'user-1');
  });

  it('throws when updating status without userId', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    await expect(controller.updateStatus('store-1', 'order-1', { status: 'CONFIRMED' as OrderStatus }, makeRequest({ userId: undefined }) as never)).rejects.toThrow();
  });

  it('updates an order', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.update('store-1', 'order-1', { shippingAddress: '123 Main St', notes: 'Updated notes' });

    expect(result).toEqual({ data: deps.order });
    expect(deps.service.updateOrder).toHaveBeenCalledWith('order-1', 'store-1', { shippingAddress: '123 Main St', notes: 'Updated notes' });
  });

  it('cancels an order and returns 204', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.cancel('store-1', 'order-1', {}, makeRequest() as never);

    expect(result).toBeUndefined();
    expect(deps.service.cancelOrder).toHaveBeenCalledWith('order-1', 'store-1', null, 'user-1');
  });

  it('cancels an order with notes', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    await controller.cancel('store-1', 'order-1', { notes: 'Customer requested cancellation' }, makeRequest() as never);

    expect(deps.service.cancelOrder).toHaveBeenCalledWith('order-1', 'store-1', 'Customer requested cancellation', 'user-1');
  });

  it('throws when cancelling without userId', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    await expect(controller.cancel('store-1', 'order-1', {}, makeRequest({ userId: undefined }) as never)).rejects.toThrow();
  });
});
