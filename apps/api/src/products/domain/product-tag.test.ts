import { validateTagName } from './product-tag';

describe('validateTagName', () => {
  it('accepts a valid name', () => {
    expect(() => validateTagName('sale')).not.toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => validateTagName('')).toThrow('Tag name is required');
    expect(() => validateTagName('   ')).toThrow('Tag name is required');
  });

  it('rejects a name longer than 50 characters', () => {
    expect(() => validateTagName('a'.repeat(51))).toThrow('Tag name must be at most 50 characters');
  });

  it('accepts a name of exactly 50 characters', () => {
    expect(() => validateTagName('a'.repeat(50))).not.toThrow();
  });
});
