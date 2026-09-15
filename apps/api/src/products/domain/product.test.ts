import { validateProductName, validateSlug, validateBasePrice } from './product';

describe('validateProductName', () => {
  it('accepts a valid name', () => {
    expect(() => validateProductName('Valid Product')).not.toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => validateProductName('')).toThrow('Product name is required');
    expect(() => validateProductName('   ')).toThrow('Product name is required');
  });

  it('rejects a name longer than 200 characters', () => {
    expect(() => validateProductName('a'.repeat(201))).toThrow('Product name must be at most 200 characters');
  });

  it('accepts a name of exactly 200 characters', () => {
    expect(() => validateProductName('a'.repeat(200))).not.toThrow();
  });
});

describe('validateSlug', () => {
  it('accepts a valid slug', () => {
    expect(() => validateSlug('valid-slug-123')).not.toThrow();
  });

  it('rejects an empty slug', () => {
    expect(() => validateSlug('')).toThrow('Slug is required');
  });

  it('rejects uppercase letters', () => {
    expect(() => validateSlug('Invalid-Slug')).toThrow('Slug must be URL-safe');
  });

  it('rejects spaces', () => {
    expect(() => validateSlug('invalid slug')).toThrow('Slug must be URL-safe');
  });

  it('rejects special characters', () => {
    expect(() => validateSlug('invalid_slug')).toThrow('Slug must be URL-safe');
  });

  it('rejects a slug longer than 200 characters', () => {
    expect(() => validateSlug('a'.repeat(201))).toThrow('Slug must be at most 200 characters');
  });
});

describe('validateBasePrice', () => {
  it('accepts zero', () => {
    expect(() => validateBasePrice(0)).not.toThrow();
  });

  it('accepts a positive price', () => {
    expect(() => validateBasePrice(99.99)).not.toThrow();
  });

  it('rejects a negative price', () => {
    expect(() => validateBasePrice(-1)).toThrow('Base price must be non-negative');
  });

  it('rejects a price above the maximum', () => {
    expect(() => validateBasePrice(1_000_000_000)).toThrow('Base price must be at most 999,999,999.99');
  });

  it('accepts the maximum price', () => {
    expect(() => validateBasePrice(999_999_999.99)).not.toThrow();
  });
});
