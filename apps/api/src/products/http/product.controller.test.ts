import { ProductController } from './product.controller';
import type { ProductService } from '../application/product.service';
import type { Product, ProductStatus } from '../domain/product';
import type { ProductWithRelations, PaginatedProducts } from '../infrastructure/product.repository';

describe('ProductController', () => {
  function makeDependencies() {
    const product: Product = {
      id: 'product-1',
      storeId: 'store-1',
      name: 'Test Product',
      slug: 'test-product',
      description: null,
      basePrice: 100,
      status: 'ACTIVE' as ProductStatus,
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const productWithRelations: ProductWithRelations = {
      ...product,
      variants: [],
      categories: [],
      tags: [],
      images: [],
    };

    const paginated: PaginatedProducts = {
      items: [product],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };

    const service = {
      list: jest.fn(async () => paginated),
      create: jest.fn(async () => product),
      findById: jest.fn(async () => productWithRelations),
      update: jest.fn(async () => product),
      archive: jest.fn(async () => ({ ...product, status: 'ARCHIVED' as ProductStatus })),
      duplicate: jest.fn(async () => ({ ...product, id: 'product-2', slug: 'test-product-copy-123' })),
    };

    return { product, productWithRelations, paginated, service };
  }

  function makeRequest(overrides: Record<string, unknown> = {}) {
    return { userId: 'user-1', ...overrides };
  }

  function makeController(service: ReturnType<typeof makeDependencies>['service']) {
    return new ProductController(service as unknown as ProductService);
  }

  it('lists products', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.list('store-1', { page: 1, limit: 20 });

    expect(result).toEqual({ data: deps.paginated });
    expect(deps.service.list).toHaveBeenCalledWith('store-1', { page: 1, limit: 20 });
  });

  it('creates a product', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);
    const body = {
      name: 'New Product',
      slug: 'new-product',
      basePrice: 100,
      variants: [{ sku: 'SKU-001', options: [], inventory: { quantity: 10, reservedQuantity: 0 } }],
      categoryIds: [],
      tagIds: [],
      images: [],
    };

    const result = await controller.create('store-1', body as never, makeRequest() as never);

    expect(result).toEqual({ data: deps.product });
    expect(deps.service.create).toHaveBeenCalledWith(expect.objectContaining({ storeId: 'store-1', createdBy: 'user-1', ...body }));
  });

  it('throws when creating without userId', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    await expect(controller.create('store-1', {} as never, makeRequest({ userId: undefined }) as never)).rejects.toThrow();
  });

  it('gets product detail', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.get('store-1', 'product-1');

    expect(result).toEqual({ data: deps.productWithRelations });
    expect(deps.service.findById).toHaveBeenCalledWith('product-1', 'store-1');
  });

  it('updates a product', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.update('store-1', 'product-1', { name: 'Updated Product' });

    expect(result).toEqual({ data: deps.product });
    expect(deps.service.update).toHaveBeenCalledWith('product-1', 'store-1', { name: 'Updated Product' });
  });

  it('archives a product and returns 204', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.archive('store-1', 'product-1');

    expect(result).toBeUndefined();
    expect(deps.service.archive).toHaveBeenCalledWith('product-1', 'store-1');
  });

  it('duplicates a product', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.duplicate('store-1', 'product-1', makeRequest() as never);

    expect(result.data).toMatchObject({ id: 'product-2' });
    expect(deps.service.duplicate).toHaveBeenCalledWith('product-1', 'store-1', 'user-1');
  });

  it('throws when duplicating without userId', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    await expect(controller.duplicate('store-1', 'product-1', makeRequest({ userId: undefined }) as never)).rejects.toThrow();
  });
});
