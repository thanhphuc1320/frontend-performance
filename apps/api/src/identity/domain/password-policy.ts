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

// Local denylist keeps common-password rejection available without a provider call.
const COMMON_PASSWORDS = new Set([
  'password',
  'password1234',
  'password123456',
  'passwordpassword',
  '123456789012',
  '1234567890123456',
  'qwertyuiop12',
  'qwertyuiopasdf',
  'welcome123456',
  'welcomehome123',
  'letmeinplease',
  'letmein123456',
  'football123456',
  'iloveyou123456',
  'adminadmin1234',
  'changeme12345',
  'monkeymonkey12',
  'dragon12345678',
  'abc123abc123',
  'trustnoone123',
]);

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
