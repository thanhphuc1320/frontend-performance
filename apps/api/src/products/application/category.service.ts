import { Injectable, Inject } from '@nestjs/common';
import { PRODUCT_REPOSITORY } from './product.tokens';
import type { ProductRepository } from '../infrastructure/product.repository';
import { validateCategoryName, validateCategorySlug } from '../domain/category';
import type { Category } from '../domain/category';
import { ApiError } from '../../http/api-error';

@Injectable()
export class CategoryService {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly repository: ProductRepository,
  ) {}

  async create(storeId: string, name: string, slug: string, parentId?: string | null, sortOrder?: number) {
    validateCategoryName(name);
    validateCategorySlug(slug);

    if (parentId) {
      const categories = await this.repository.findCategoriesByStore(storeId);
      const parent = categories.find((c) => c.id === parentId);
      if (!parent) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Parent category not found');
      }

      const depth = this.computeDepth(categories, parentId);
      if (depth + 1 > 3) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Category depth would exceed maximum of 3 levels');
      }
    }

    return this.repository.createCategory(storeId, name, slug, parentId, sortOrder);
  }

  async list(storeId: string): Promise<Category[]> {
    const categories = await this.repository.findCategoriesByStore(storeId);
    return this.buildTree(categories);
  }

  async delete(id: string, storeId: string) {
    return this.repository.deleteCategory(id, storeId);
  }

  private computeDepth(categories: Category[], categoryId: string): number {
    let depth = 1;
    let current = categories.find((c) => c.id === categoryId);
    while (current?.parentId) {
      depth++;
      current = categories.find((c) => c.id === current!.parentId);
    }
    return depth;
  }

  private buildTree(categories: Category[]): Category[] {
    const map = new Map<string, Category>();
    const roots: Category[] = [];

    for (const category of categories) {
      map.set(category.id, { ...category, children: [] });
    }

    for (const category of categories) {
      const node = map.get(category.id)!;
      if (category.parentId) {
        const parent = map.get(category.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}
