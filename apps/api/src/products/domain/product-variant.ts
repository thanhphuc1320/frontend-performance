export type ProductVariantStatus = 'ACTIVE' | 'INACTIVE';

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
  updatedAt: Date;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string | null;
  priceDelta: number;
  status: ProductVariantStatus;
  options: VariantOption[];
  inventory: Inventory;
}

export function validateSku(sku: string): void {
  if (!sku || sku.trim().length === 0) {
    throw new Error('SKU is required');
  }
  if (sku.length > 50) {
    throw new Error('SKU must be at most 50 characters');
  }
}

export function validateInventory(qty: number, reserved: number): void {
  if (qty < 0) {
    throw new Error('Quantity must be non-negative');
  }
  if (reserved < 0) {
    throw new Error('Reserved quantity must be non-negative');
  }
  if (reserved > qty) {
    throw new Error('Reserved quantity cannot exceed quantity');
  }
}
