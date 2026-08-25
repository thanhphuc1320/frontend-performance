import { Inject } from '@nestjs/common';
import type { RequestContext } from '../../auth/application/session.service';
import { ApiError } from '../../http/api-error';
import type { RoleCode } from '../../authorization/domain/permission';
import { STORE_REPOSITORY } from './store.tokens';

export type MembershipRecord = { id: string; storeId: string; userId: string; roleCode: string; status: string };
export type StoreRecord = { id: string; status: 'ACTIVE' | 'DEACTIVATED' };

export type MembershipRepository = {
  transaction<T>(work: (executor: unknown) => Promise<T>): Promise<T>;
  findStoreById(storeId: string, executor?: unknown): Promise<StoreRecord | null>;
  findMembership(storeId: string, userId: string, executor?: unknown): Promise<MembershipRecord | null>;
  listMemberships(storeId: string, executor?: unknown): Promise<MembershipRecord[]>;
  updateMembershipStatus(membershipId: string, status: string, executor?: unknown): Promise<MembershipRecord>;
  updateMembershipRole(membershipId: string, roleCode: string, executor?: unknown): Promise<MembershipRecord>;
  countActiveOwners(storeId: string, executor?: unknown): Promise<number>;
};

const MANAGING_ROLES: readonly string[] = ['OWNER', 'ADMIN'];

function assertStoreActive(store: StoreRecord | null): void {
  if (!store || store.status !== 'ACTIVE') {
    throw new ApiError(403, 'STORE_ACCESS_DENIED', 'Store access denied');
  }
}

function assertCanManage(actorMembership: MembershipRecord | null): void {
  if (!actorMembership || !MANAGING_ROLES.includes(actorMembership.roleCode) || actorMembership.status !== 'ACTIVE') {
    throw new ApiError(403, 'MEMBERSHIP_MANAGE_FORBIDDEN', 'Membership management forbidden');
  }
}

function assertValidStatus(currentStatus: string, nextStatus: string): void {
  const allowed: Record<string, readonly string[]> = {
    ACTIVE: ['SUSPENDED', 'LEFT', 'REMOVED'],
    SUSPENDED: ['ACTIVE', 'REMOVED'],
    INVITED: ['ACTIVE', 'LEFT', 'REMOVED'],
  };
  if (!allowed[currentStatus]?.includes(nextStatus)) {
    throw new ApiError(400, 'INVALID_STATUS_TRANSITION', `Cannot transition from ${currentStatus} to ${nextStatus}`);
  }
}

export class MembershipService {
  constructor(
    @Inject(STORE_REPOSITORY)
    private readonly repository: MembershipRepository,
  ) {}

  async leave(context: RequestContext, storeId: string): Promise<MembershipRecord> {
    return this.repository.transaction(async (executor) => {
      const store = await this.repository.findStoreById(storeId, executor);
      assertStoreActive(store);
      const membership = await this.repository.findMembership(storeId, context.userId, executor);
      if (!membership || (membership.status !== 'ACTIVE' && membership.status !== 'SUSPENDED' && membership.status !== 'INVITED')) {
        throw new ApiError(403, 'STORE_ACCESS_DENIED', 'Store access denied');
      }
      assertValidStatus(membership.status, 'LEFT');
      return this.repository.updateMembershipStatus(membership.id, 'LEFT', executor);
    });
  }

  async suspend(context: RequestContext, storeId: string, userId: string): Promise<MembershipRecord> {
    return this.mutateMembership(context, storeId, userId, 'SUSPENDED');
  }

  async remove(context: RequestContext, storeId: string, userId: string): Promise<MembershipRecord> {
    return this.mutateMembership(context, storeId, userId, 'REMOVED');
  }

  async changeRole(context: RequestContext, storeId: string, userId: string, roleCode: RoleCode): Promise<MembershipRecord> {
    return this.repository.transaction(async (executor) => {
      const store = await this.repository.findStoreById(storeId, executor);
      assertStoreActive(store);
      await this.acquireAdvisoryLock(storeId, executor);
      const actorMembership = await this.repository.findMembership(storeId, context.userId, executor);
      assertCanManage(actorMembership);
      const targetMembership = await this.repository.findMembership(storeId, userId, executor);
      if (!targetMembership || targetMembership.status !== 'ACTIVE') {
        throw new ApiError(404, 'MEMBERSHIP_NOT_FOUND', 'Membership not found');
      }
      if (targetMembership.roleCode === 'OWNER' && roleCode !== 'OWNER') {
        const ownerCount = await this.repository.countActiveOwners(storeId, executor);
        if (ownerCount <= 1) {
          throw new ApiError(409, 'FINAL_OWNER_PROTECTED', 'Cannot change the final Owner membership');
        }
      }
      const result = await this.repository.updateMembershipRole(targetMembership.id, roleCode, executor);
      await this.recheckActorMembership(storeId, context.userId, executor);
      return result;
    });
  }

  async list(context: RequestContext, storeId: string): Promise<MembershipRecord[]> {
    const store = await this.repository.findStoreById(storeId);
    assertStoreActive(store);
    const membership = await this.repository.findMembership(storeId, context.userId);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ApiError(403, 'STORE_ACCESS_DENIED', 'Store access denied');
    }
    return this.repository.listMemberships(storeId);
  }

  private async mutateMembership(context: RequestContext, storeId: string, userId: string, nextStatus: string): Promise<MembershipRecord> {
    return this.repository.transaction(async (executor) => {
      const store = await this.repository.findStoreById(storeId, executor);
      assertStoreActive(store);
      await this.acquireAdvisoryLock(storeId, executor);
      const actorMembership = await this.repository.findMembership(storeId, context.userId, executor);
      assertCanManage(actorMembership);
      const targetMembership = await this.repository.findMembership(storeId, userId, executor);
      if (!targetMembership || targetMembership.status !== 'ACTIVE') {
        throw new ApiError(404, 'MEMBERSHIP_NOT_FOUND', 'Membership not found');
      }
      assertValidStatus(targetMembership.status, nextStatus);
      if (targetMembership.roleCode === 'OWNER' && nextStatus !== 'ACTIVE') {
        const ownerCount = await this.repository.countActiveOwners(storeId, executor);
        if (ownerCount <= 1) {
          throw new ApiError(409, 'FINAL_OWNER_PROTECTED', 'Cannot change the final Owner membership');
        }
      }
      const result = await this.repository.updateMembershipStatus(targetMembership.id, nextStatus, executor);
      await this.recheckActorMembership(storeId, context.userId, executor);
      return result;
    });
  }

  private async acquireAdvisoryLock(storeId: string, executor: unknown): Promise<void> {
    const db = executor as { query(text: string, values?: readonly unknown[]): Promise<unknown> };
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [storeId]);
  }

  private async recheckActorMembership(storeId: string, userId: string, executor: unknown): Promise<void> {
    const current = await this.repository.findMembership(storeId, userId, executor);
    if (!current || current.status !== 'ACTIVE' || !MANAGING_ROLES.includes(current.roleCode)) {
      throw new ApiError(403, 'MEMBERSHIP_REVOKED', 'Membership was revoked during operation');
    }
  }
}
