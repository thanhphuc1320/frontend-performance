export interface Product {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string | null;
  priceDelta: number;
  status: 'ACTIVE' | 'INACTIVE';
  options: VariantOption[];
  inventory: Inventory | null;
}

export interface VariantOption {
  id: string;
  variantId: string;
  optionName: string;
  optionValue: string;
}

export interface Inventory {
  id: string;
  variantId: string;
  quantity: number;
  reservedQuantity: number;
  updatedAt: string;
}

export interface Category {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  children?: Category[];
}

export interface ProductTag {
  id: string;
  storeId: string;
  name: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  altText: string | null;
  sortOrder: number;
}

export interface ProductDetail {
  product: Product;
  variants: ProductVariant[];
  categories: Category[];
  tags: ProductTag[];
  images: ProductImage[];
}

export interface PaginatedProducts {
  items: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductFilters {
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  categoryId?: string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}
