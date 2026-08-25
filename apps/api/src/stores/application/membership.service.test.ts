import type { RequestContext } from '../../auth/application/session.service';
import { MembershipService, type MembershipRepository } from './membership.service';

describe('MembershipService', () => {
  function makeRepository() {
    return {
      transaction: jest.fn(async <T>(work: (tx: unknown) => Promise<T>): Promise<T> => work(makeRepository())),
      query: jest.fn(async () => ({ rows: [] })),
      findStoreById: jest.fn(async () => null as { id: string; status: 'ACTIVE' | 'DEACTIVATED' } | null),
      findMembership: jest.fn(async () => null as { id: string; storeId: string; userId: string; roleCode: string; status: string } | null),
      listMemberships: jest.fn(async () => [] as { id: string; storeId: string; userId: string; roleCode: string; status: string }[]),
      updateMembershipStatus: jest.fn(async (_id: string, status: string) => ({ id: 'm1', storeId: 's1', userId: 'u1', roleCode: 'STAFF', status })),
      updateMembershipRole: jest.fn(async () => ({ id: 'm1', storeId: 's1', userId: 'u1', roleCode: 'ADMIN', status: 'ACTIVE' })),
      countActiveOwners: jest.fn(async () => 1),
    };
  }

  function makeContext(overrides: Partial<RequestContext> = {}): RequestContext {
    return { userId: 'actor-1', sessionId: 'session-1', ...overrides };
  }

  it('leaves a Store as self-service transitioning to LEFT', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'm1', storeId: 's1', userId: 'actor-1', roleCode: 'STAFF', status: 'ACTIVE' });
    const service = new MembershipService(repo as unknown as MembershipRepository);

    const result = await service.leave(makeContext(), 's1');

    expect(result.status).toBe('LEFT');
    expect(repo.updateMembershipStatus).toHaveBeenCalledWith('m1', 'LEFT', expect.anything());
  });

  it('rejects leave when Store is deactivated', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'DEACTIVATED' });
    const service = new MembershipService(repo as unknown as MembershipRepository);

    await expect(service.leave(makeContext(), 's1')).rejects.toMatchObject({ status: 403, code: 'STORE_ACCESS_DENIED' });
  });

  it('rejects leave when no active membership exists', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce(null);
    const service = new MembershipService(repo as unknown as MembershipRepository);

    await expect(service.leave(makeContext(), 's1')).rejects.toMatchObject({ status: 403, code: 'STORE_ACCESS_DENIED' });
  });

  it('allows Owner to suspend a member', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'm2', storeId: 's1', userId: 'u2', roleCode: 'STAFF', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' });
    const service = new MembershipService(repo as unknown as MembershipRepository);

    const result = await service.suspend(makeContext(), 's1', 'u2');

    expect(result.status).toBe('SUSPENDED');
    expect(repo.updateMembershipStatus).toHaveBeenCalledWith('m2', 'SUSPENDED', expect.anything());
  });

  it('allows Admin to suspend a member', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'ADMIN', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'm2', storeId: 's1', userId: 'u2', roleCode: 'STAFF', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'ADMIN', status: 'ACTIVE' });
    const service = new MembershipService(repo as unknown as MembershipRepository);

    await expect(service.suspend(makeContext(), 's1', 'u2')).resolves.toMatchObject({ status: 'SUSPENDED' });
  });

  it('rejects suspend by non-Owner/Admin', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'STAFF', status: 'ACTIVE' });
    const service = new MembershipService(repo as unknown as MembershipRepository);

    await expect(service.suspend(makeContext(), 's1', 'u2')).rejects.toMatchObject({ status: 403, code: 'MEMBERSHIP_MANAGE_FORBIDDEN' });
  });

  it('protects final Owner from suspension using advisory lock pattern', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'm2', storeId: 's1', userId: 'u2', roleCode: 'OWNER', status: 'ACTIVE' });
    repo.countActiveOwners.mockResolvedValueOnce(1);
    const service = new MembershipService(repo as unknown as MembershipRepository);

    await expect(service.suspend(makeContext(), 's1', 'u2')).rejects.toMatchObject({ status: 409, code: 'FINAL_OWNER_PROTECTED' });
  });

  it('allows Owner to remove a member', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'm2', storeId: 's1', userId: 'u2', roleCode: 'STAFF', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' });
    const service = new MembershipService(repo as unknown as MembershipRepository);

    const result = await service.remove(makeContext(), 's1', 'u2');

    expect(result.status).toBe('REMOVED');
  });

  it('protects final Owner from removal', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'm2', storeId: 's1', userId: 'u2', roleCode: 'OWNER', status: 'ACTIVE' });
    repo.countActiveOwners.mockResolvedValueOnce(1);
    const service = new MembershipService(repo as unknown as MembershipRepository);

    await expect(service.remove(makeContext(), 's1', 'u2')).rejects.toMatchObject({ status: 409, code: 'FINAL_OWNER_PROTECTED' });
  });

  it('allows Owner to change a member role', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'm2', storeId: 's1', userId: 'u2', roleCode: 'STAFF', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' });
    const service = new MembershipService(repo as unknown as MembershipRepository);

    const result = await service.changeRole(makeContext(), 's1', 'u2', 'ADMIN');

    expect(result.roleCode).toBe('ADMIN');
    expect(repo.updateMembershipRole).toHaveBeenCalledWith('m2', 'ADMIN', expect.anything());
  });

  it('rejects role change with invalid role code', async () => {
    const repo = makeRepository();
    const service = new MembershipService(repo as unknown as MembershipRepository);

    await expect(service.changeRole(makeContext(), 's1', 'u2', 'INVALID_ROLE' as unknown as 'ADMIN')).rejects.toMatchObject({ status: 400, code: 'INVALID_ROLE_CODE' });
  });

  it('rejects role change that would leave zero active Owners', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'm2', storeId: 's1', userId: 'u2', roleCode: 'OWNER', status: 'ACTIVE' });
    repo.countActiveOwners.mockResolvedValueOnce(1);
    const service = new MembershipService(repo as unknown as MembershipRepository);

    await expect(service.changeRole(makeContext(), 's1', 'u2', 'ADMIN')).rejects.toMatchObject({ status: 409, code: 'FINAL_OWNER_PROTECTED' });
  });

  it('rejects downgrade of self when it would leave zero active Owners', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' });
    repo.countActiveOwners.mockResolvedValueOnce(1);
    const service = new MembershipService(repo as unknown as MembershipRepository);

    await expect(service.changeRole(makeContext(), 's1', 'actor-1', 'ADMIN')).rejects.toMatchObject({ status: 409, code: 'FINAL_OWNER_PROTECTED' });
  });

  it('rechecks actor permission after revoke in case session was invalidated', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'ADMIN', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'm2', storeId: 's1', userId: 'u2', roleCode: 'STAFF', status: 'ACTIVE' });
    // After performing the update, recheck actor membership
    repo.findMembership.mockResolvedValueOnce(null);
    const service = new MembershipService(repo as unknown as MembershipRepository);

    await expect(service.suspend(makeContext(), 's1', 'u2')).rejects.toMatchObject({ status: 403, code: 'MEMBERSHIP_REVOKED' });
  });

  it('lists memberships scoped to a Store', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce({ id: 'actor-m', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' });
    repo.listMemberships.mockResolvedValueOnce([
      { id: 'm1', storeId: 's1', userId: 'actor-1', roleCode: 'OWNER', status: 'ACTIVE' },
      { id: 'm2', storeId: 's1', userId: 'u2', roleCode: 'STAFF', status: 'ACTIVE' },
    ]);
    const service = new MembershipService(repo as unknown as MembershipRepository);

    const result = await service.list(makeContext(), 's1');

    expect(result).toHaveLength(2);
    expect(repo.listMemberships).toHaveBeenCalledWith('s1');
  });

  it('rejects list for non-member', async () => {
    const repo = makeRepository();
    repo.findStoreById.mockResolvedValueOnce({ id: 's1', status: 'ACTIVE' });
    repo.findMembership.mockResolvedValueOnce(null);
    const service = new MembershipService(repo as unknown as MembershipRepository);

    await expect(service.list(makeContext(), 's1')).rejects.toMatchObject({ status: 403, code: 'STORE_ACCESS_DENIED' });
  });
});
