import argon2 from 'argon2';
import nodemailer from 'nodemailer';
import type { ApiConfig } from '@commerce/config';
import type { CompromisedPasswordChecker } from '../domain/password-policy';
import type { EmailDelivery, EmailMessage } from '../application/ports/email-delivery';
import type { PasswordHasher } from '../application/ports/password-hasher';

export class Argon2idPasswordHasher implements PasswordHasher {
  hash(plainText: string): Promise<string> {
    return argon2.hash(plainText, { type: argon2.argon2id, memoryCost: 19 * 1024, timeCost: 2, parallelism: 1 });
  }

  verify(plainText: string, encodedHash: string): Promise<boolean> {
    return argon2.verify(encodedHash, plainText);
  }
}

export class HibpPasswordChecker implements CompromisedPasswordChecker {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async isCompromised(hashPrefix: string, hashSuffix: string): Promise<boolean> {
    const response = await this.fetcher(`https://api.pwnedpasswords.com/range/${encodeURIComponent(hashPrefix)}`, { headers: { 'Add-Padding': 'true' } });
    if (!response.ok) throw new Error(`HIBP request failed with ${response.status}`);
    const suffix = hashSuffix.toUpperCase();
    const matches = (await response.text()).split('\n').map((line) => line.split(':', 1)[0]?.trim().toUpperCase());
    return matches.includes(suffix);
  }
}

export class SmtpEmailDelivery implements EmailDelivery {
  readonly from: string;
  private readonly transporter: nodemailer.Transporter;

  constructor(config: Pick<ApiConfig, 'SMTP_URL' | 'EMAIL_FROM'>) {
    this.from = config.EMAIL_FROM;
    this.transporter = nodemailer.createTransport(config.SMTP_URL);
  }

  sendVerification(message: EmailMessage): Promise<void> { return this.send(message, 'Verify your email'); }
  sendPasswordReset(message: EmailMessage): Promise<void> { return this.send(message, 'Reset your password'); }
  sendEmailChange(message: EmailMessage): Promise<void> { return this.send(message, 'Confirm your email change'); }
  sendInvitation(message: EmailMessage): Promise<void> { return this.send(message, 'You are invited'); }

  private async send(message: EmailMessage, subject: string): Promise<void> {
    await this.transporter.sendMail({ from: this.from, to: message.recipient, subject, text: message.actionUrl });
  }
}
