import { createHash, timingSafeEqual } from 'node:crypto';
import type { EmailDelivery, EmailMessage } from '../application/ports/email-delivery';
import type { PasswordHasher } from '../application/ports/password-hasher';

export class MemoryEmailDelivery implements EmailDelivery {
  readonly messages: EmailMessage[] = [];

  async sendVerification(message: EmailMessage): Promise<void> { this.messages.push(message); }
  async sendPasswordReset(message: EmailMessage): Promise<void> { this.messages.push(message); }
  async sendEmailChange(message: EmailMessage): Promise<void> { this.messages.push(message); }
  async sendInvitation(message: EmailMessage): Promise<void> { this.messages.push(message); }
}

export class TestPasswordHasher implements PasswordHasher {
  async hash(plainText: string): Promise<string> { return `test:${createHash('sha256').update(plainText).digest('hex')}`; }

  async verify(plainText: string, encodedHash: string): Promise<boolean> {
    const expected = Buffer.from(await this.hash(plainText));
    const actual = Buffer.from(encodedHash);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}

export const noCompromisedPasswordChecker = { isCompromised: async () => false };
