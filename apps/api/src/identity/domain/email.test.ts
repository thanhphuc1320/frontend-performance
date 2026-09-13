import { Email, normalizeEmail } from './email';

describe('normalizeEmail', () => {
  it('trims and lowercases an email for global uniqueness', () => {
    expect(normalizeEmail('  Alice@Example.COM  ')).toBe('alice@example.com');
  });

  it('stores the normalized value in the email value object', () => {
    expect(Email.create('  Alice@Example.COM  ').value).toBe('alice@example.com');
  });

  it('rejects an empty email', () => {
    expect(() => normalizeEmail('   ')).toThrow('Invalid email');
  });

  it('rejects malformed email formats', () => {
    expect(() => normalizeEmail('alice.example.com')).toThrow('Invalid email');
    expect(() => normalizeEmail('alice@')).toThrow('Invalid email');
  });
});
