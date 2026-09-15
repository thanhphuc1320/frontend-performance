import { CategoryService } from './category.service';
import type { ProductRepository } from '../infrastructure/product.repository';
import type { Category } from '../domain/category';

describe('CategoryService', () => {
  function setup() {
    const categories: Category[] = [
      { id: 'cat-1', storeId: 'store-1', name: 'Root', slug: 'root', parentId: null, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() },
      { id: 'cat-2', storeId: 'store-1', name: 'Child', slug: 'child', parentId: 'cat-1', sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: 'cat-3', storeId: 'store-1', name: 'Grandchild', slug: 'grandchild', parentId: 'cat-2', sortOrder: 2, createdAt: new Date(), updatedAt: new Date() },
    ];

    type TestRepository = {
      createCategory: jest.Mock;
      findCategoriesByStore: jest.Mock;
      deleteCategory: jest.Mock;
    };

    const repository: TestRepository = {
      createCategory: jest.fn(async () => categories[0]),
      findCategoriesByStore: jest.fn(async () => categories),
      deleteCategory: jest.fn(async () => undefined),
    };

    const service = new CategoryService(repository as unknown as ProductRepository);
    return { categories, repository, service };
  }

  it('creates a category', async () => {
    const { service, repository } = setup();
    const result = await service.create('store-1', 'New Category', 'new-category');
    expect(result).toMatchObject({ name: 'Root' });
    expect(repository.createCategory).toHaveBeenCalledWith('store-1', 'New Category', 'new-category', undefined, undefined);
  });

  it('creates a category with a parent', async () => {
    const { service, repository, categories } = setup();
    repository.createCategory.mockResolvedValueOnce({ ...categories[1], name: 'Child Category' });
    const result = await service.create('store-1', 'Child Category', 'child-category', 'cat-1');
    expect(result).toMatchObject({ name: 'Child Category' });
    expect(repository.createCategory).toHaveBeenCalledWith('store-1', 'Child Category', 'child-category', 'cat-1', undefined);
  });

  it('fails to create when depth would exceed 3', async () => {
    const { service } = setup();
    await expect(service.create('store-1', 'Too Deep', 'too-deep', 'cat-3')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('fails to delete when category has products', async () => {
    const { service, repository } = setup();
    const error = new Error('Category has products');
    (error as Error & { code: string }).code = 'CONFLICT';
    repository.deleteCategory.mockRejectedValueOnce(error);

    await expect(service.delete('cat-1', 'store-1')).rejects.toThrow('Category has products');
  });

  it('fails to delete when category has children', async () => {
    const { service, repository } = setup();
    const error = new Error('Category has subcategories');
    (error as Error & { code: string }).code = 'CONFLICT';
    repository.deleteCategory.mockRejectedValueOnce(error);

    await expect(service.delete('cat-1', 'store-1')).rejects.toThrow('Category has subcategories');
  });
});
