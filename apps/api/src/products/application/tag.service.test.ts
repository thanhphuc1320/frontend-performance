import { TagService } from './tag.service';
import type { ProductRepository } from '../infrastructure/product.repository';
import type { ProductTag } from '../domain/product-tag';

describe('TagService', () => {
  function setup() {
    const tag: ProductTag = { id: 'tag-1', storeId: 'store-1', name: 'Featured', createdAt: new Date() };

    type TestRepository = {
      createTag: jest.Mock;
      findTagsByStore: jest.Mock;
      deleteTag: jest.Mock;
    };

    const repository: TestRepository = {
      createTag: jest.fn(async () => tag),
      findTagsByStore: jest.fn(async () => [tag]),
      deleteTag: jest.fn(async () => undefined),
    };

    const service = new TagService(repository as unknown as ProductRepository);
    return { tag, repository, service };
  }

  it('creates a tag', async () => {
    const { service, repository, tag } = setup();
    const result = await service.create('store-1', 'Featured');
    expect(result).toEqual(tag);
    expect(repository.createTag).toHaveBeenCalledWith('store-1', 'Featured');
  });

  it('lists tags for a store', async () => {
    const { service, repository, tag } = setup();
    const result = await service.list('store-1');
    expect(result).toEqual([tag]);
    expect(repository.findTagsByStore).toHaveBeenCalledWith('store-1');
  });

  it('deletes a tag', async () => {
    const { service, repository } = setup();
    await service.delete('tag-1', 'store-1');
    expect(repository.deleteTag).toHaveBeenCalledWith('tag-1', 'store-1');
  });
});
