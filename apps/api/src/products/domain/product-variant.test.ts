import { validateSku, validateInventory } from './product-variant';

describe('validateSku', () => {
  it('accepts a valid SKU', () => {
    expect(() => validateSku('SKU-123')).not.toThrow();
  });

  it('rejects an empty SKU', () => {
    expect(() => validateSku('')).toThrow('SKU is required');
    expect(() => validateSku('   ')).toThrow('SKU is required');
  });

  it('rejects a SKU longer than 50 characters', () => {
    expect(() => validateSku('A'.repeat(51))).toThrow('SKU must be at most 50 characters');
  });

  it('accepts a SKU of exactly 50 characters', () => {
    expect(() => validateSku('A'.repeat(50))).not.toThrow();
  });
});

describe('validateInventory', () => {
  it('accepts valid inventory', () => {
    expect(() => validateInventory(100, 0)).not.toThrow();
    expect(() => validateInventory(100, 50)).not.toThrow();
    expect(() => validateInventory(100, 100)).not.toThrow();
  });

  it('rejects negative quantity', () => {
    expect(() => validateInventory(-1, 0)).toThrow('Quantity must be non-negative');
  });

  it('rejects negative reserved quantity', () => {
    expect(() => validateInventory(100, -1)).toThrow('Reserved quantity must be non-negative');
  });

  it('rejects reserved quantity exceeding quantity', () => {
    expect(() => validateInventory(100, 101)).toThrow('Reserved quantity cannot exceed quantity');
  });
});
