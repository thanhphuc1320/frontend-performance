import { createHash } from 'node:crypto';

export type PasswordPolicyReason =
  | 'minimum-length'
  | 'common-password'
  | 'compromised-password'
  | 'compromised-password-check-unavailable';

export type PasswordPolicyResult =
  | { valid: true }
  | { valid: false; reason: PasswordPolicyReason };

export interface CompromisedPasswordChecker {
  isCompromised(hashPrefix: string, hashSuffix: string): Promise<boolean>;
}

const COMMON_PASSWORDS = new Set(['password1234', 'password', '123456789012', 'qwertyuiop12']);

export async function validatePassword(
  value: string,
  checker: CompromisedPasswordChecker,
): Promise<PasswordPolicyResult> {
  if (value.length < 12) return { valid: false, reason: 'minimum-length' };
  if (COMMON_PASSWORDS.has(value.toLowerCase())) return { valid: false, reason: 'common-password' };

  try {
    const digest = createHash('sha1').update(value, 'utf8').digest('hex').toUpperCase();
    if (await checker.isCompromised(digest.slice(0, 5), digest.slice(5))) {
      return { valid: false, reason: 'compromised-password' };
    }
  } catch {
    return { valid: false, reason: 'compromised-password-check-unavailable' };
  }

  return { valid: true };
}
