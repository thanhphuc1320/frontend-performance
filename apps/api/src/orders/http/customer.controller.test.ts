import { CustomerController } from './customer.controller';
import type { CustomerService } from '../application/customer.service';
import type { Customer } from '../domain/customer';

describe('CustomerController', () => {
  function makeDependencies() {
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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const service = {
      list: jest.fn(async () => [customer]),
      create: jest.fn(async () => customer),
      findById: jest.fn(async () => ({ customer, recentOrders: [] })),
      update: jest.fn(async () => customer),
      delete: jest.fn(async () => undefined),
    };

    return { customer, service };
  }

  function makeController(service: ReturnType<typeof makeDependencies>['service']) {
    return new CustomerController(service as unknown as CustomerService);
  }

  it('lists customers', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.list('store-1');

    expect(result).toEqual({ data: [deps.customer] });
    expect(deps.service.list).toHaveBeenCalledWith('store-1', undefined);
  });

  it('lists customers with search', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    await controller.list('store-1', 'test');

    expect(deps.service.list).toHaveBeenCalledWith('store-1', 'test');
  });

  it('creates a customer', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);
    const body = { name: 'New Customer', phone: '0901234567' };

    const result = await controller.create('store-1', body as never);

    expect(result).toEqual({ data: deps.customer });
    expect(deps.service.create).toHaveBeenCalledWith(expect.objectContaining({ storeId: 'store-1', ...body }));
  });

  it('gets customer detail', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.get('store-1', 'customer-1');

    expect(result).toEqual({ data: { customer: deps.customer, recentOrders: [] } });
    expect(deps.service.findById).toHaveBeenCalledWith('customer-1', 'store-1');
  });

  it('updates a customer', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.update('store-1', 'customer-1', { name: 'Updated Customer' });

    expect(result).toEqual({ data: deps.customer });
    expect(deps.service.update).toHaveBeenCalledWith('customer-1', 'store-1', { name: 'Updated Customer' });
  });

  it('deletes a customer and returns 204', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.remove('store-1', 'customer-1');

    expect(result).toBeUndefined();
    expect(deps.service.delete).toHaveBeenCalledWith('customer-1', 'store-1');
  });
});
