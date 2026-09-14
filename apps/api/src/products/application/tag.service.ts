import { Injectable, Inject } from '@nestjs/common';
import { PRODUCT_REPOSITORY } from './product.tokens';
import type { ProductRepository } from '../infrastructure/product.repository';
import { validateTagName } from '../domain/product-tag';

@Injectable()
export class TagService {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly repository: ProductRepository,
  ) {}

  async create(storeId: string, name: string) {
    validateTagName(name);
    return this.repository.createTag(storeId, name);
  }

  async list(storeId: string) {
    return this.repository.findTagsByStore(storeId);
  }

  async delete(id: string, storeId: string) {
    return this.repository.deleteTag(id, storeId);
  }
}
