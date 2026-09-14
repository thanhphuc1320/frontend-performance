import { ProductService } from './product.service';
import type { ProductRepository } from '../infrastructure/product.repository';
import type { Product, ProductStatus } from '../domain/product';
import type { ProductWithRelations, PaginatedProducts } from '../infrastructure/product.repository';

describe('ProductService', () => {
  function setup() {
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

    type TestRepository = {
      create: jest.Mock;
      findWithRelations: jest.Mock;
      list: jest.Mock;
      update: jest.Mock;
      archive: jest.Mock;
      duplicate: jest.Mock;
      existsSlug: jest.Mock;
      existsSku: jest.Mock;
    };

    const repository: TestRepository = {
      create: jest.fn(async () => product),
      findWithRelations: jest.fn(async () => productWithRelations),
      list: jest.fn(async () => paginated),
      update: jest.fn(async () => product),
      archive: jest.fn(async () => ({ ...product, status: 'ARCHIVED' as ProductStatus })),
      duplicate: jest.fn(async () => ({ ...product, id: 'product-2', slug: 'test-product-copy-123' })),
      existsSlug: jest.fn(async () => false),
      existsSku: jest.fn(async () => false),
    };

    const service = new ProductService(repository as unknown as ProductRepository);
    return { product, productWithRelations, paginated, repository, service };
  }

  it('creates a product with valid input', async () => {
    const { service, repository } = setup();
    const input = {
      storeId: 'store-1',
      name: 'Test Product',
      slug: 'test-product',
      basePrice: 100,
      createdBy: 'user-1',
      variants: [{ sku: 'SKU-001', options: [], inventory: { quantity: 10, reservedQuantity: 0 } }],
      categoryIds: [],
      tagIds: [],
      images: [],
    };

    const result = await service.create(input);
    expect(result).toMatchObject({ name: 'Test Product', slug: 'test-product' });
    expect(repository.create).toHaveBeenCalledWith(input);
  });

  it('fails to create when slug already exists', async () => {
    const { service, repository } = setup();
    repository.existsSlug.mockResolvedValueOnce(true);
    const input = {
      storeId: 'store-1',
      name: 'Test Product',
      slug: 'test-product',
      basePrice: 100,
      createdBy: 'user-1',
      variants: [{ sku: 'SKU-001', options: [], inventory: { quantity: 10, reservedQuantity: 0 } }],
      categoryIds: [],
      tagIds: [],
      images: [],
    };

    await expect(service.create(input)).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('fails to create when SKU already exists', async () => {
    const { service, repository } = setup();
    repository.existsSku.mockResolvedValueOnce(true);
    const input = {
      storeId: 'store-1',
      name: 'Test Product',
      slug: 'test-product',
      basePrice: 100,
      createdBy: 'user-1',
      variants: [{ sku: 'SKU-001', options: [], inventory: { quantity: 10, reservedQuantity: 0 } }],
      categoryIds: [],
      tagIds: [],
      images: [],
    };

    await expect(service.create(input)).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('fails to create when no variants provided', async () => {
    const { service } = setup();
    const input = {
      storeId: 'store-1',
      name: 'Test Product',
      slug: 'test-product',
      basePrice: 100,
      createdBy: 'user-1',
      variants: [] as { sku: string; options: []; inventory: { quantity: number; reservedQuantity: number } }[],
      categoryIds: [],
      tagIds: [],
      images: [],
    };

    await expect(service.create(input)).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  });

  it('returns product with relations when finding by id', async () => {
    const { service, repository, productWithRelations } = setup();
    const result = await service.findById('product-1', 'store-1');
    expect(result).toEqual(productWithRelations);
    expect(repository.findWithRelations).toHaveBeenCalledWith('product-1', 'store-1');
  });

  it('returns paginated results when listing', async () => {
    const { service, repository, paginated } = setup();
    const result = await service.list('store-1', { page: 1, limit: 20 });
    expect(result).toEqual(paginated);
    expect(repository.list).toHaveBeenCalledWith('store-1', { page: 1, limit: 20 });
  });

  it('archives a product and returns ARCHIVED status', async () => {
    const { service, repository } = setup();
    const result = await service.archive('product-1', 'store-1');
    expect(result.status).toBe('ARCHIVED');
    expect(repository.archive).toHaveBeenCalledWith('product-1', 'store-1');
  });

  it('updates a product with valid fields', async () => {
    const { service, repository } = setup();
    const result = await service.update('product-1', 'store-1', { name: 'Updated Product' });
    expect(result).toMatchObject({ name: 'Test Product' });
    expect(repository.update).toHaveBeenCalledWith('product-1', 'store-1', { name: 'Updated Product' });
  });

  it('fails to update when slug already exists', async () => {
    const { service, repository } = setup();
    repository.existsSlug.mockResolvedValueOnce(true);
    await expect(service.update('product-1', 'store-1', { slug: 'existing-slug' })).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
    });
    expect(repository.update).not.toHaveBeenCalled();
  });
});
