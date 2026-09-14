import { CategoryController } from './category.controller';
import type { CategoryService } from '../application/category.service';
import type { Category } from '../domain/category';

describe('CategoryController', () => {
  function makeDependencies() {
    const flatCategories: Category[] = [
      { id: 'cat-1', storeId: 'store-1', name: 'Root', slug: 'root', parentId: null, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() },
      { id: 'cat-2', storeId: 'store-1', name: 'Child', slug: 'child', parentId: 'cat-1', sortOrder: 1, createdAt: new Date(), updatedAt: new Date() },
      { id: 'cat-3', storeId: 'store-1', name: 'Grandchild', slug: 'grandchild', parentId: 'cat-2', sortOrder: 2, createdAt: new Date(), updatedAt: new Date() },
    ];

    const treeCategories: Category[] = [
      {
        ...flatCategories[0]!,
        children: [
          {
            ...flatCategories[1]!,
            children: [flatCategories[2]!],
          },
        ],
      },
    ];

    const service = {
      list: jest.fn(async () => treeCategories),
      create: jest.fn(async () => flatCategories[0]),
      update: jest.fn(async () => flatCategories[0]),
      delete: jest.fn(async () => undefined),
    };

    return { flatCategories, treeCategories, service };
  }

  function makeController(service: ReturnType<typeof makeDependencies>['service']) {
    return new CategoryController(service as unknown as CategoryService);
  }

  it('lists categories as flat list by default', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.list('store-1');

    expect(result.data).toHaveLength(3);
    expect(result.data[0]).toMatchObject({ id: 'cat-1' });
    expect(result.data[1]).toMatchObject({ id: 'cat-2' });
    expect(result.data[2]).toMatchObject({ id: 'cat-3' });
    expect(result.data[0]).not.toHaveProperty('children');
    expect(result.data[1]).not.toHaveProperty('children');
    expect(result.data[2]).not.toHaveProperty('children');
    expect(deps.service.list).toHaveBeenCalledWith('store-1');
  });

  it('lists categories as tree when tree query is present', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.list('store-1', 'true');

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ id: 'cat-1' });
    expect(result.data[0]!.children).toHaveLength(1);
    expect(result.data[0]!.children![0]).toMatchObject({ id: 'cat-2' });
    expect(deps.service.list).toHaveBeenCalledWith('store-1');
  });

  it('creates a category', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.create('store-1', { name: 'New Category', slug: 'new-category' });

    expect(result).toEqual({ data: deps.flatCategories[0] });
    expect(deps.service.create).toHaveBeenCalledWith('store-1', 'New Category', 'new-category', undefined, undefined);
  });

  it('creates a category with parent and sortOrder', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    await controller.create('store-1', { name: 'Child', slug: 'child', parentId: 'cat-1', sortOrder: 5 });

    expect(deps.service.create).toHaveBeenCalledWith('store-1', 'Child', 'child', 'cat-1', 5);
  });

  it('deletes a category', async () => {
    const deps = makeDependencies();
    const controller = makeController(deps.service);

    const result = await controller.delete('store-1', 'cat-1');

    expect(result).toBeUndefined();
    expect(deps.service.delete).toHaveBeenCalledWith('cat-1', 'store-1');
  });
});
