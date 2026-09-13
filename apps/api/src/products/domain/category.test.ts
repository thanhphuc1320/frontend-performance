import { validateCategoryName, validateCategorySlug } from './category';

describe('validateCategoryName', () => {
  it('accepts a valid name', () => {
    expect(() => validateCategoryName('Electronics')).not.toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => validateCategoryName('')).toThrow('Category name is required');
    expect(() => validateCategoryName('   ')).toThrow('Category name is required');
  });

  it('rejects a name longer than 100 characters', () => {
    expect(() => validateCategoryName('a'.repeat(101))).toThrow('Category name must be at most 100 characters');
  });

  it('accepts a name of exactly 100 characters', () => {
    expect(() => validateCategoryName('a'.repeat(100))).not.toThrow();
  });
});

describe('validateCategorySlug', () => {
  it('accepts a valid slug', () => {
    expect(() => validateCategorySlug('electronics')).not.toThrow();
  });

  it('rejects an empty slug', () => {
    expect(() => validateCategorySlug('')).toThrow('Category slug is required');
  });

  it('rejects uppercase letters', () => {
    expect(() => validateCategorySlug('Electronics')).toThrow('Category slug must be URL-safe');
  });

  it('rejects a slug longer than 200 characters', () => {
    expect(() => validateCategorySlug('a'.repeat(201))).toThrow('Category slug must be at most 200 characters');
  });
});
