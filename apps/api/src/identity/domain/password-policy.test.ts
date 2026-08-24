import { validatePassword } from './password-policy';

describe('validatePassword', () => {
  it('rejects passwords shorter than 12 characters', async () => {
    await expect(validatePassword('short', { isCompromised: async () => false })).resolves.toEqual({
      valid: false,
      reason: 'minimum-length',
    });
  });

  it('rejects common passwords', async () => {
    await expect(validatePassword('password1234', { isCompromised: async () => false })).resolves.toEqual({
      valid: false,
      reason: 'common-password',
    });
  });

  it('rejects compromised passwords through the checker port', async () => {
    const checker = { isCompromised: async () => true };

    await expect(validatePassword('a-unique-long-password', checker)).resolves.toEqual({
      valid: false,
      reason: 'compromised-password',
    });
  });

  it('sends only the five-character SHA-1 prefix and suffix to the checker', async () => {
    const isCompromised = jest.fn().mockResolvedValue(false);

    await validatePassword('a-unique-long-password', { isCompromised });

    expect(isCompromised).toHaveBeenCalledWith(
      '89F0F',
      'F0593B665DAB049BACADC6C9008E883ECE0',
    );
  });

  it('fails closed when the compromised-password provider fails', async () => {
    const checker = { isCompromised: async () => { throw new Error('provider unavailable'); } };

    await expect(validatePassword('a-unique-long-password', checker)).resolves.toEqual({
      valid: false,
      reason: 'compromised-password-check-unavailable',
    });
  });
});
