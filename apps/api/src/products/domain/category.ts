export interface Category {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  children?: Category[];
  createdAt: Date;
  updatedAt: Date;
}

export function validateCategoryName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new Error('Category name is required');
  }
  if (name.length > 100) {
    throw new Error('Category name must be at most 100 characters');
  }
}

export function validateCategorySlug(slug: string): void {
  if (!slug || slug.trim().length === 0) {
    throw new Error('Category slug is required');
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error('Category slug must be URL-safe (lowercase letters, numbers, and hyphens only)');
  }
  if (slug.length > 200) {
    throw new Error('Category slug must be at most 200 characters');
  }
}
