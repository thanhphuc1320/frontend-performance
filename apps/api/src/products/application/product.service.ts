import { Injectable, Inject } from '@nestjs/common';
import { PRODUCT_REPOSITORY } from './product.tokens';
import type { ProductRepository, CreateProductInput, ProductFilters } from '../infrastructure/product.repository';
import { validateProductName, validateSlug, validateBasePrice } from '../domain/product';
import { validateSku } from '../domain/product-variant';
import { ApiError } from '../../http/api-error';

@Injectable()
export class ProductService {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly repository: ProductRepository,
  ) {}

  async create(input: CreateProductInput) {
    validateProductName(input.name);
    validateSlug(input.slug);
    validateBasePrice(input.basePrice);

    if (!input.variants || input.variants.length === 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Product must have at least one variant');
    }

    const slugExists = await this.repository.existsSlug(input.storeId, input.slug);
    if (slugExists) {
      throw new ApiError(409, 'CONFLICT', 'Product slug already exists');
    }

    const skus = new Set<string>();
    for (const variant of input.variants) {
      validateSku(variant.sku);
      if (skus.has(variant.sku)) {
        throw new ApiError(409, 'CONFLICT', `Duplicate SKU in request: ${variant.sku}`);
      }
      skus.add(variant.sku);
      const skuExists = await this.repository.existsSku(variant.sku);
      if (skuExists) {
        throw new ApiError(409, 'CONFLICT', `SKU already exists: ${variant.sku}`);
      }
    }

    return this.repository.create(input);
  }

  async findById(id: string, storeId: string) {
    return this.repository.findWithRelations(id, storeId);
  }

  async list(storeId: string, filters: ProductFilters) {
    return this.repository.list(storeId, filters);
  }

  async update(id: string, storeId: string, updates: Partial<Pick<import('../domain/product').Product, 'name' | 'slug' | 'description' | 'basePrice' | 'status'>>) {
    if (updates.name !== undefined) validateProductName(updates.name);
    if (updates.slug !== undefined) validateSlug(updates.slug);
    if (updates.basePrice !== undefined) validateBasePrice(updates.basePrice);

    if (updates.slug !== undefined) {
      const slugExists = await this.repository.existsSlug(storeId, updates.slug, id);
      if (slugExists) {
        throw new ApiError(409, 'CONFLICT', 'Product slug already exists');
      }
    }

    return this.repository.update(id, storeId, updates);
  }

  async archive(id: string, storeId: string) {
    return this.repository.archive(id, storeId);
  }

  async duplicate(id: string, storeId: string, createdBy: string) {
    return this.repository.duplicate(id, storeId, createdBy);
  }
}
