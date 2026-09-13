export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface Product {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  status: ProductStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export function validateProductName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new Error('Product name is required');
  }
  if (name.length > 200) {
    throw new Error('Product name must be at most 200 characters');
  }
}

export function validateSlug(slug: string): void {
  if (!slug || slug.trim().length === 0) {
    throw new Error('Slug is required');
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error('Slug must be URL-safe (lowercase letters, numbers, and hyphens only)');
  }
  if (slug.length > 200) {
    throw new Error('Slug must be at most 200 characters');
  }
}

export function validateBasePrice(price: number): void {
  if (price < 0) {
    throw new Error('Base price must be non-negative');
  }
  if (price > 999_999_999.99) {
    throw new Error('Base price must be at most 999,999,999.99');
  }
}
