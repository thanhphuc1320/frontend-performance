import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  archiveProduct,
  duplicateProduct,
  listCategories,
  createCategory,
  deleteCategory,
  listTags,
  createTag,
  deleteTag,
} from './api';

const API_URL = 'http://localhost:4000';
const storeId = 's1';

function makeProduct(id: string): import('./types').Product {
  return {
    id,
    storeId,
    name: `Product ${id}`,
    slug: `product-${id}`,
    description: null,
    basePrice: 100,
    status: 'ACTIVE',
    createdBy: 'u1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

describe('products API client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('document', { cookie: 'csrf_token=test-csrf' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetch(response: unknown, status = 200) {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
    } as Response);
  }

  describe('listProducts', () => {
    it('returns paginated products on success', async () => {
      const paginated: import('./types').PaginatedProducts = {
        items: [makeProduct('p1')],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockFetch({ data: paginated });
      const result = await listProducts(storeId);
      expect(result).toEqual(paginated);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/products`,
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
      );
    });

    it('applies filters as query params', async () => {
      mockFetch({ data: { items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } } });
      await listProducts(storeId, { status: 'ACTIVE', search: 'foo', page: 2, limit: 10 });
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/products?status=ACTIVE&search=foo&page=2&limit=10`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('throws ApiError on failure', async () => {
      mockFetch({ error: { code: 'STORE_NOT_FOUND', message: 'Store not found' } }, 404);
      await expect(listProducts(storeId)).rejects.toThrow('Store not found');
    });
  });

  describe('getProduct', () => {
    it('returns product detail on success', async () => {
      const detail: import('./types').ProductDetail = {
        product: makeProduct('p1'),
        variants: [],
        categories: [],
        tags: [],
        images: [],
      };
      mockFetch({ data: detail });
      const result = await getProduct(storeId, 'p1');
      expect(result).toEqual(detail);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/products/p1`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('throws on 404', async () => {
      mockFetch({ error: { code: 'PRODUCT_NOT_FOUND', message: 'Not found' } }, 404);
      await expect(getProduct(storeId, 'p99')).rejects.toThrow('Not found');
    });
  });

  describe('createProduct', () => {
    it('returns created product', async () => {
      const product = makeProduct('p1');
      mockFetch({ data: product });
      const result = await createProduct(storeId, { name: 'Product p1' });
      expect(result).toEqual(product);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/products`,
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            'x-csrf-token': 'test-csrf',
          }),
          body: JSON.stringify({ name: 'Product p1' }),
        }),
      );
    });

    it('throws on 400', async () => {
      mockFetch({ error: { code: 'VALIDATION_ERROR', message: 'Name is required' } }, 400);
      await expect(createProduct(storeId, {})).rejects.toThrow('Name is required');
    });
  });

  describe('updateProduct', () => {
    it('returns updated product', async () => {
      const product = { ...makeProduct('p1'), name: 'Updated' };
      mockFetch({ data: product });
      const result = await updateProduct(storeId, 'p1', { name: 'Updated' });
      expect(result).toEqual(product);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/products/p1`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Updated' }),
        }),
      );
    });

    it('throws on 403', async () => {
      mockFetch({ error: { code: 'FORBIDDEN', message: 'No permission' } }, 403);
      await expect(updateProduct(storeId, 'p1', {})).rejects.toThrow('No permission');
    });
  });

  describe('archiveProduct', () => {
    it('returns void on success', async () => {
      mockFetch({ data: undefined });
      await expect(archiveProduct(storeId, 'p1')).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/products/p1`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('throws on 404', async () => {
      mockFetch({ error: { code: 'NOT_FOUND', message: 'Product not found' } }, 404);
      await expect(archiveProduct(storeId, 'p99')).rejects.toThrow('Product not found');
    });
  });

  describe('duplicateProduct', () => {
    it('returns duplicated product', async () => {
      const product = makeProduct('p2');
      mockFetch({ data: product });
      const result = await duplicateProduct(storeId, 'p1');
      expect(result).toEqual(product);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/products/p1/duplicate`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('throws on 409', async () => {
      mockFetch({ error: { code: 'CONFLICT', message: 'Slug exists' } }, 409);
      await expect(duplicateProduct(storeId, 'p1')).rejects.toThrow('Slug exists');
    });
  });

  describe('listCategories', () => {
    it('returns categories array', async () => {
      const categories: import('./types').Category[] = [
        { id: 'c1', storeId, name: 'Category 1', slug: 'cat-1', parentId: null, sortOrder: 0 },
      ];
      mockFetch({ data: categories });
      const result = await listCategories(storeId);
      expect(result).toEqual(categories);
    });

    it('includes tree param', async () => {
      mockFetch({ data: [] });
      await listCategories(storeId, true);
      expect(fetch).toHaveBeenCalledWith(
        `${API_URL}/api/v1/stores/${storeId}/categories?tree=true`,
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('throws on 401', async () => {
      mockFetch({ error: { code: 'UNAUTHENTICATED', message: 'Auth required' } }, 401);
      await expect(listCategories(storeId)).rejects.toThrow('Auth required');
    });
  });

  describe('createCategory', () => {
    it('returns created category', async () => {
      const category: import('./types').Category = {
        id: 'c1', storeId, name: 'New', slug: 'new', parentId: null, sortOrder: 0,
      };
      mockFetch({ data: category });
      const result = await createCategory(storeId, { name: 'New' });
      expect(result).toEqual(category);
    });

    it('throws on 400', async () => {
      mockFetch({ error: { code: 'VALIDATION_ERROR', message: 'Invalid' } }, 400);
      await expect(createCategory(storeId, {})).rejects.toThrow('Invalid');
    });
  });

  describe('deleteCategory', () => {
    it('returns void on success', async () => {
      mockFetch({ data: undefined });
      await expect(deleteCategory(storeId, 'c1')).resolves.toBeUndefined();
    });

    it('throws on 404', async () => {
      mockFetch({ error: { code: 'NOT_FOUND', message: 'Category not found' } }, 404);
      await expect(deleteCategory(storeId, 'c99')).rejects.toThrow('Category not found');
    });
  });

  describe('listTags', () => {
    it('returns tags array', async () => {
      const tags: import('./types').ProductTag[] = [{ id: 't1', storeId, name: 'Tag 1' }];
      mockFetch({ data: tags });
      const result = await listTags(storeId);
      expect(result).toEqual(tags);
    });

    it('throws on 403', async () => {
      mockFetch({ error: { code: 'FORBIDDEN', message: 'Access denied' } }, 403);
      await expect(listTags(storeId)).rejects.toThrow('Access denied');
    });
  });

  describe('createTag', () => {
    it('returns created tag', async () => {
      const tag: import('./types').ProductTag = { id: 't1', storeId, name: 'New Tag' };
      mockFetch({ data: tag });
      const result = await createTag(storeId, { name: 'New Tag' });
      expect(result).toEqual(tag);
    });

    it('throws on 409', async () => {
      mockFetch({ error: { code: 'CONFLICT', message: 'Tag exists' } }, 409);
      await expect(createTag(storeId, { name: 'Dup' })).rejects.toThrow('Tag exists');
    });
  });

  describe('deleteTag', () => {
    it('returns void on success', async () => {
      mockFetch({ data: undefined });
      await expect(deleteTag(storeId, 't1')).resolves.toBeUndefined();
    });

    it('throws on 404', async () => {
      mockFetch({ error: { code: 'NOT_FOUND', message: 'Tag not found' } }, 404);
      await expect(deleteTag(storeId, 't99')).rejects.toThrow('Tag not found');
    });
  });
});
