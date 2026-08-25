import { createHash, randomBytes } from 'node:crypto';
import type { RequestContext } from '../../auth/application/session.service';
import { InvitationService, type InvitationRepository } from './invitation.service';

describe('InvitationService', () => {
  function makeRepository() {
    return {
      transaction: jest.fn(async <T>(work: (tx: unknown) => Promise<T>): Promise<T> => work(makeRepository())),
      query: jest.fn(async () => ({ rows: [] })),
      findStoreById: jest.fn(async () => null as { id: string; status: 'ACTIVE' | 'DEACTIVATED' } | null),
      findMembership: jest.fn(async () => null as { id: string; storeId: string; userId: string; roleCode: string; status: string } | null),
      createMembership: jest.fn(async () => ({ id: 'm1', storeId: 's1', userId: 'u1', roleCode: 'STAFF', status: 'ACTIVE' })),
      updateMembershipStatus: jest.fn(async (_id: string, status: string) => ({ id: 'm1', storeId: 's1', userId: 'u1', roleCode: 'STAFF', status })),
      updateMembershipRole: jest.fn(async (_id: string, roleCode: string) => ({ id: 'm1', storeId: 's1', userId: 'u1', roleCode, status: 'ACTIVE' })),
      createInvitation: jest.fn(async () => ({ id: 'inv1', storeId: 's1', email: 'invitee@example.com', roleCode: 'STAFF', tokenHash: 'hash', status: 'PENDING', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), consumedAt: null, revokedAt: null })),
      findInvitationByTokenHash: jest.fn(async () => null as { id: string; storeId: string; email: string; roleCode: string; tokenHash: string; status: string; expiresAt: Date; consumedAt: Date | null; revokedAt: Date | null } | null),
      findInvitationById: jest.fn(async () => null as { id: string; storeId: string; email: string; roleCode: string; tokenHash: string; status: string; expiresAt: Date; consumedAt: Date | null; revokedAt: Date | null } | null),
      revokeInvitation: jest.fn(async () => ({ id: 'inv1', storeId: 's1', email: 'invitee@example.com', roleCode: 'STAFF', tokenHash: 'hash', status: 'REVOKED', expiresAt: new Date(), consumedAt: null, revokedAt: new Date() })),
      consumeInvitation: jest.fn(async () => true),
    };
  }

  function makeIdentity() {
    return {
      findUserById: jest.fn(async () => null as { id: string; email: string; status: string } | null),
      findUserByEmail: jest.fn(async () => null as { id: string; email: string; status: string } | null),
    };
  }

  function makeEmailDelivery() {
    return {
      sendInvitation: jest.fn(async () => undefined),
    };
  }

  function makeContext(overrides: Partial<RequestContext> = {}): RequestContext {
    return { userId: 'actor-1', sessionId: 'session-1', ...overrides };
  }

  it('creates an invitation with 7-day expiry and hashed token', async () => {
    const repo = makeRepository();
    const identity = makeIdentity();
    const email = makeEmailDelivery();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' });
    const service = new InvitationService(repo as unknown as InvitationRepository, identity, email);

    const result = await service.invite(makeContext(), 's1', 'invitee@example.com', 'STAFF');

    expect(result.status).toBe('PENDING');
    const created = (repo.createInvitation.mock.calls[0] as unknown as [{ storeId: string; email: string; roleCode: string; tokenHash: string; expiresAt: Date }])[0];
    expect(created.storeId).toBe('s1');
    expect(created.email).toBe('invitee@example.com');
    expect(created.roleCode).toBe('STAFF');
    expect(created.tokenHash).toMatch(/^[a-f0-9]{64}$/i);
    const days = (created.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(days).toBeCloseTo(7, 0);
    expect(email.sendInvitation).toHaveBeenCalled();
  });

  it('rejects invitation to deactivated Store', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'DEACTIVATED' });
    const service = new InvitationService(repo as unknown as InvitationRepository, makeIdentity(), makeEmailDelivery());

    await expect(service.invite(makeContext(), 's1', 'invitee@example.com', 'STAFF')).rejects.toMatchObject({ status: 403, code: 'STORE_ACCESS_DENIED' });
  });

  it('rejects invitation by non-Owner/Admin', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'STAFF', status: 'ACTIVE' });
    const service = new InvitationService(repo as unknown as InvitationRepository, makeIdentity(), makeEmailDelivery());

    await expect(service.invite(makeContext(), 's1', 'invitee@example.com', 'STAFF')).rejects.toMatchObject({ status: 403, code: 'MEMBERSHIP_MANAGE_FORBIDDEN' });
  });

  it('rejects invitation with invalid role code', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' });
    const service = new InvitationService(repo as unknown as InvitationRepository, makeIdentity(), makeEmailDelivery());

    await expect(service.invite(makeContext(), 's1', 'invitee@example.com', 'INVALID_ROLE' as unknown as 'STAFF')).rejects.toMatchObject({ status: 400, code: 'INVALID_ROLE_CODE' });
  });

  it('revokes an existing invitation and creates a new one on resend', async () => {
    const repo = makeRepository();
    const identity = makeIdentity();
    const email = makeEmailDelivery();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' });
    repo.findInvitationById.mockResolvedValueOnce({ id: 'inv1', storeId: 's1', email: 'invitee@example.com', roleCode: 'STAFF', tokenHash: 'oldhash', status: 'PENDING', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), consumedAt: null, revokedAt: null });
    const service = new InvitationService(repo as unknown as InvitationRepository, identity, email);

    const result = await service.resend(makeContext(), 's1', 'inv1');

    expect(result.status).toBe('PENDING');
    expect(repo.revokeInvitation).toHaveBeenCalledWith('inv1', expect.anything());
    expect(repo.createInvitation).toHaveBeenCalled();
    expect(email.sendInvitation).toHaveBeenCalled();
  });

  it('does not send email if transaction fails', async () => {
    const repo = makeRepository();
    const identity = makeIdentity();
    const email = makeEmailDelivery();
    repo.transaction.mockRejectedValueOnce(new Error('DB failure'));
    const service = new InvitationService(repo as unknown as InvitationRepository, identity, email);

    await expect(service.invite(makeContext(), 's1', 'invitee@example.com', 'STAFF')).rejects.toThrow('DB failure');
    expect(email.sendInvitation).not.toHaveBeenCalled();
  });

  it('revokes a pending invitation', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' });
    repo.findInvitationById.mockResolvedValueOnce({ id: 'inv1', storeId: 's1', email: 'invitee@example.com', roleCode: 'STAFF', tokenHash: 'hash', status: 'PENDING', expiresAt: new Date(), consumedAt: null, revokedAt: null });
    const service = new InvitationService(repo as unknown as InvitationRepository, makeIdentity(), makeEmailDelivery());

    const result = await service.revoke(makeContext(), 's1', 'inv1');

    expect(result.status).toBe('REVOKED');
  });

  it('accepts an invitation for an existing user and creates membership', async () => {
    const repo = makeRepository();
    const identity = makeIdentity();
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    repo.findInvitationByTokenHash.mockResolvedValueOnce({ id: 'inv1', storeId: 's1', email: 'invitee@example.com', roleCode: 'STAFF', tokenHash, status: 'PENDING', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), consumedAt: null, revokedAt: null });
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    identity.findUserById.mockResolvedValueOnce({ id: 'u1', email: 'invitee@example.com', status: 'ACTIVE' });
    const service = new InvitationService(repo as unknown as InvitationRepository, identity, makeEmailDelivery());

    const result = await service.accept(rawToken, 'u1');

    expect(result.membership.roleCode).toBe('STAFF');
    expect(repo.consumeInvitation).toHaveBeenCalledWith(tokenHash, expect.anything());
    const membershipCall = (repo.createMembership.mock.calls[0] as unknown as [{ storeId: string; userId: string; roleCode: string }])[0];
    expect(membershipCall.storeId).toBe('s1');
    expect(membershipCall.userId).toBe('u1');
    expect(membershipCall.roleCode).toBe('STAFF');
  });

  it('accepts an invitation and reactivates a LEFT membership instead of creating duplicate', async () => {
    const repo = makeRepository();
    const identity = makeIdentity();
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    repo.findInvitationByTokenHash.mockResolvedValueOnce({ id: 'inv1', storeId: 's1', email: 'invitee@example.com', roleCode: 'STAFF', tokenHash, status: 'PENDING', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), consumedAt: null, revokedAt: null });
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    identity.findUserById.mockResolvedValueOnce({ id: 'u1', email: 'invitee@example.com', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'm1', storeId: 's1', userId: 'u1', roleCode: 'STAFF', status: 'LEFT' });
    const service = new InvitationService(repo as unknown as InvitationRepository, identity, makeEmailDelivery());

    const result = await service.accept(rawToken, 'u1');

    expect(result.membership.status).toBe('ACTIVE');
    expect(repo.updateMembershipStatus).toHaveBeenCalledWith('m1', 'ACTIVE', expect.anything());
    expect(repo.createMembership).not.toHaveBeenCalled();
  });

  it('rejects acceptance for deactivated Store', async () => {
    const repo = makeRepository();
    const identity = makeIdentity();
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    repo.findInvitationByTokenHash.mockResolvedValueOnce({ id: 'inv1', storeId: 's1', email: 'invitee@example.com', roleCode: 'STAFF', tokenHash, status: 'PENDING', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), consumedAt: null, revokedAt: null });
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'DEACTIVATED' });
    const service = new InvitationService(repo as unknown as InvitationRepository, identity, makeEmailDelivery());

    await expect(service.accept(rawToken, 'u1')).rejects.toMatchObject({ status: 403, code: 'STORE_ACCESS_DENIED' });
  });

  it('rejects acceptance with expired token', async () => {
    const repo = makeRepository();
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    repo.findInvitationByTokenHash.mockResolvedValueOnce({ id: 'inv1', storeId: 's1', email: 'invitee@example.com', roleCode: 'STAFF', tokenHash, status: 'PENDING', expiresAt: new Date(Date.now() - 1000), consumedAt: null, revokedAt: null });
    const service = new InvitationService(repo as unknown as InvitationRepository, makeIdentity(), makeEmailDelivery());

    await expect(service.accept(rawToken, 'u1')).rejects.toMatchObject({ status: 400, code: 'INVITATION_INVALID' });
  });

  it('rejects acceptance with already consumed token', async () => {
    const repo = makeRepository();
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    repo.findInvitationByTokenHash.mockResolvedValueOnce({ id: 'inv1', storeId: 's1', email: 'invitee@example.com', roleCode: 'STAFF', tokenHash, status: 'ACCEPTED', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), consumedAt: new Date(), revokedAt: null });
    const service = new InvitationService(repo as unknown as InvitationRepository, makeIdentity(), makeEmailDelivery());

    await expect(service.accept(rawToken, 'u1')).rejects.toMatchObject({ status: 400, code: 'INVITATION_INVALID' });
  });

  it('rejects acceptance when user email does not match invitation email', async () => {
    const repo = makeRepository();
    const identity = makeIdentity();
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    repo.findInvitationByTokenHash.mockResolvedValueOnce({ id: 'inv1', storeId: 's1', email: 'invitee@example.com', roleCode: 'STAFF', tokenHash, status: 'PENDING', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), consumedAt: null, revokedAt: null });
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    identity.findUserById.mockResolvedValueOnce({ id: 'u1', email: 'different@example.com', status: 'ACTIVE' });
    const service = new InvitationService(repo as unknown as InvitationRepository, identity, makeEmailDelivery());

    await expect(service.accept(rawToken, 'u1')).rejects.toMatchObject({ status: 403, code: 'INVITATION_EMAIL_MISMATCH' });
  });

  it('rejects acceptance when consumeInvitation returns false (race condition)', async () => {
    const repo = makeRepository();
    const identity = makeIdentity();
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    repo.findInvitationByTokenHash.mockResolvedValueOnce({ id: 'inv1', storeId: 's1', email: 'invitee@example.com', roleCode: 'STAFF', tokenHash, status: 'PENDING', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), consumedAt: null, revokedAt: null });
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    identity.findUserById.mockResolvedValueOnce({ id: 'u1', email: 'invitee@example.com', status: 'ACTIVE' });
    repo.consumeInvitation.mockResolvedValueOnce(false);
    const service = new InvitationService(repo as unknown as InvitationRepository, identity, makeEmailDelivery());

    await expect(service.accept(rawToken, 'u1')).rejects.toMatchObject({ status: 400, code: 'INVITATION_INVALID' });
  });
});
