const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(normalized)) {
    throw new Error('Invalid email');
  }

  return normalized;
}

export class Email {
  private constructor(public readonly value: string) {}

  static create(value: string): Email {
    return new Email(normalizeEmail(value));
  }
}
