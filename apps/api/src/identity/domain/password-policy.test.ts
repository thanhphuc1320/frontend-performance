import { validatePassword } from './password-policy';

describe('validatePassword', () => {
  it('rejects passwords shorter than 8 characters', async () => {
    await expect(validatePassword('short', { isCompromised: async () => false })).resolves.toEqual({
      valid: false,
      reason: 'minimum-length',
    });
  });

  it('rejects passwords without a number', async () => {
    await expect(validatePassword('Password!', { isCompromised: async () => false })).resolves.toEqual({
      valid: false,
      reason: 'missing-number',
    });
  });

  it('rejects passwords without a lowercase letter', async () => {
    await expect(validatePassword('PASSWORD1!', { isCompromised: async () => false })).resolves.toEqual({
      valid: false,
      reason: 'missing-lowercase',
    });
  });

  it('rejects passwords without an uppercase letter', async () => {
    await expect(validatePassword('password1!', { isCompromised: async () => false })).resolves.toEqual({
      valid: false,
      reason: 'missing-uppercase',
    });
  });

  it('rejects passwords without a special character', async () => {
    await expect(validatePassword('Password1', { isCompromised: async () => false })).resolves.toEqual({
      valid: false,
      reason: 'missing-special-char',
    });
  });

  it('accepts valid passwords meeting all requirements', async () => {
    await expect(validatePassword('MyStr0ng!Pass', { isCompromised: async () => false })).resolves.toEqual({
      valid: true,
    });
  });

  it('rejects common passwords', async () => {
    await expect(validatePassword('Password1234!', { isCompromised: async () => false })).resolves.toEqual({
      valid: false,
      reason: 'common-password',
    });
  });

  it.each(['Welcome123456!', 'Letmein1!', 'Football1!'])('rejects authoritative common password %s locally', async (password) => {
    const isCompromised = jest.fn().mockResolvedValue(false);

    await expect(validatePassword(password, { isCompromised })).resolves.toEqual({
      valid: false,
      reason: 'common-password',
    });
    expect(isCompromised).not.toHaveBeenCalled();
  });

  it('rejects compromised passwords through the checker port', async () => {
    const checker = { isCompromised: async () => true };

    await expect(validatePassword('UniqueLongP@ss1', checker)).resolves.toEqual({
      valid: false,
      reason: 'compromised-password',
    });
  });

  it('sends only the five-character SHA-1 prefix and suffix to the checker', async () => {
    const isCompromised = jest.fn().mockResolvedValue(false);

    await validatePassword('UniqueLongP@ss1', { isCompromised });

    expect(isCompromised).toHaveBeenCalledWith(
      'BDA65',
      '2F8AC6E193772DA7BD2FD76E1B2E500B94C',
    );
  });

  it('fails closed when the compromised-password provider fails', async () => {
    const checker = { isCompromised: async () => { throw new Error('provider unavailable'); } };

    await expect(validatePassword('UniqueLongP@ss1', checker)).resolves.toEqual({
      valid: false,
      reason: 'compromised-password-check-unavailable',
    });
  });
});
