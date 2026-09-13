export interface PasswordHasher {
  hash(plainText: string): Promise<string>;
  verify(plainText: string, encodedHash: string): Promise<boolean>;
}
