import { randomUUID } from 'node:crypto';
import { UserStatus } from '../../identity/domain/user';
import type { IdentityStore } from '../../identity/application/identity.service';
import { ApiError } from '../../http/api-error';
import { AuditService } from '../../audit/audit.service';
import { Inject } from '@nestjs/common';
import { IDENTITY_REPOSITORY } from '../../identity/application/identity.tokens';
import { STORE_REPOSITORY } from './store.tokens';
import type { ApiConfig } from '@commerce/config';
import { API_CONFIG } from '../../identity/application/identity.tokens';

type StoreRecord = { id: string; name: string; timezone: string; currency: string; status: 'ACTIVE' | 'DEACTIVATED'; createdBy: string };
type MembershipRecord = { id: string; storeId: string; userId: string; roleCode: string; status: string };
type StoreRepository = {
  createStore(input: { id: string; name: string; timezone?: string; currency?: string; createdBy: string; idempotencyKey: string }, executor?: unknown): Promise<StoreRecord>;
  createMembership(input: { id: string; storeId: string; userId: string; roleCode: string }, executor?: unknown): Promise<MembershipRecord>;
  listForUser(userId: string): Promise<StoreRecord[]>;
  findMembership(storeId: string, userId: string): Promise<MembershipRecord | null>;
  findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<{ store: StoreRecord; membership: MembershipRecord } | null>;
  updateStore(storeId: string, input: { name?: string; timezone?: string; currency?: string }, executor?: unknown): Promise<StoreRecord>;
  deactivateStore(storeId: string, executor?: unknown): Promise<StoreRecord>;
  transaction?<T>(work: (executor: unknown) => Promise<T>): Promise<T>;
};

export class StoreService {
  constructor(
    @Inject(STORE_REPOSITORY)
    private readonly repository: StoreRepository,
    @Inject(IDENTITY_REPOSITORY)
    private readonly identity: Pick<IdentityStore, 'findUserById'>,
    @Inject(API_CONFIG)
    private readonly config: Pick<ApiConfig, 'NODE_ENV'> = { NODE_ENV: 'test' },
    private readonly auditService?: AuditService,
  ) {}

  async createFirstStore(userId: string, input: { name: string; timezone?: string; currency?: string }, idempotencyKey: string, requestId?: string): Promise<{ store: StoreRecord; membership: MembershipRecord }> {
    const user = await this.identity.findUserById(userId);
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
    if (user.status !== UserStatus.ACTIVE) throw new ApiError(403, 'EMAIL_VERIFICATION_REQUIRED', 'Email verification required');
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Idempotency-Key is required');
    if (!input || typeof input.name !== 'string') throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid request');
    const name = input.name.trim();
    if (!name) throw new ApiError(400, 'VALIDATION_ERROR', 'Store name is required');
    if (input.currency !== undefined && input.currency !== 'VND') throw new ApiError(400, 'VALIDATION_ERROR', 'Unsupported currency');
    const timezone = input.timezone ?? 'Asia/Ho_Chi_Minh';
    if (!isIanaTimezone(timezone)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid timezone');
    const prior = await this.repository.findByIdempotencyKey(userId, idempotencyKey);
    if (prior) {
      if (prior.store.name !== name || prior.store.timezone !== timezone || prior.store.currency !== 'VND') throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key has different request state');
      return prior;
    }

    try {
      const create = (executor: unknown) => this.createStoreAndOwner(userId, { name, timezone, currency: 'VND', idempotencyKey }, executor);
      const result = this.repository.transaction ? await this.repository.transaction(create) : await create(undefined);

      await this.auditService?.log({
        actorUserId: userId,
        storeId: result.store.id,
        action: 'store.create',
        resourceType: 'store',
        resourceId: result.store.id,
        requestId,
        afterData: { name: result.store.name, timezone: result.store.timezone, currency: result.store.currency },
      });

      return result;
    } catch (error) {
      if (!isConflict(error)) throw error;
      const existing = await this.repository.findByIdempotencyKey(userId, idempotencyKey);
      if (!existing) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key cannot be reconciled');
      if (existing.store.name !== name || existing.store.timezone !== timezone || existing.store.currency !== 'VND') throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key has different request state');
      return existing;
    }
  }

  async listStores(userId: string): Promise<StoreRecord[]> {
    await this.requireActiveUser(userId);
    return this.repository.listForUser(userId);
  }

  async selectStore(userId: string, storeId: string): Promise<{ storeId: string }> {
    await this.requireActiveUser(userId);
    const stores = await this.repository.listForUser(userId);
    if (!stores.some((store) => store.id === storeId && store.status === 'ACTIVE')) throw new ApiError(403, 'STORE_ACCESS_DENIED', 'Store access denied');
    return { storeId };
  }

  private async requireActiveUser(userId: string): Promise<void> {
    const user = await this.identity.findUserById(userId);
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
    if (user.status !== UserStatus.ACTIVE) throw new ApiError(403, 'EMAIL_VERIFICATION_REQUIRED', 'Email verification required');
  }

  async updateStore(userId: string, storeId: string, input: { name?: string; timezone?: string; currency?: string }, requestId?: string): Promise<StoreRecord> {
    await this.requireActiveUser(userId);
    const stores = await this.repository.listForUser(userId);
    const store = stores.find((s) => s.id === storeId && s.status === 'ACTIVE');
    if (!store) throw new ApiError(403, 'STORE_ACCESS_DENIED', 'Store access denied');
    const membership = await this.repository.findMembership(storeId, userId);
    if (!membership || membership.status !== 'ACTIVE' || membership.roleCode !== 'OWNER') {
      throw new ApiError(403, 'STORE_ACCESS_DENIED', 'Store access denied');
    }
    if (input.timezone !== undefined && !isIanaTimezone(input.timezone)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid timezone');
    if (input.currency !== undefined && input.currency !== 'VND') throw new ApiError(400, 'VALIDATION_ERROR', 'Unsupported currency');

    const updated = await this.repository.updateStore(storeId, input);

    await this.auditService?.log({
      actorUserId: userId,
      storeId,
      action: 'store.update',
      resourceType: 'store',
      resourceId: storeId,
      requestId,
      beforeData: { name: store.name, timezone: store.timezone, currency: store.currency },
      afterData: { name: updated.name, timezone: updated.timezone, currency: updated.currency },
    });

    return updated;
  }

  async deactivateStore(userId: string, storeId: string, requestId?: string): Promise<StoreRecord> {
    await this.requireActiveUser(userId);
    const stores = await this.repository.listForUser(userId);
    const store = stores.find((s) => s.id === storeId && s.status === 'ACTIVE');
    if (!store) throw new ApiError(403, 'STORE_ACCESS_DENIED', 'Store access denied');
    const membership = await this.repository.findMembership(storeId, userId);
    if (!membership || membership.status !== 'ACTIVE' || membership.roleCode !== 'OWNER') {
      throw new ApiError(403, 'STORE_ACCESS_DENIED', 'Store access denied');
    }

    const updated = await this.repository.deactivateStore(storeId);

    await this.auditService?.log({
      actorUserId: userId,
      storeId,
      action: 'store.deactivate',
      resourceType: 'store',
      resourceId: storeId,
      requestId,
      beforeData: { status: 'ACTIVE' },
      afterData: { status: 'DEACTIVATED' },
    });

    return updated;
  }

  private async createStoreAndOwner(userId: string, input: { name: string; timezone: string; currency: string; idempotencyKey: string }, executor: unknown): Promise<{ store: StoreRecord; membership: MembershipRecord }> {
    const store = await this.repository.createStore({ id: randomUUID(), name: input.name, timezone: input.timezone, currency: input.currency, createdBy: userId, idempotencyKey: input.idempotencyKey }, executor);
    const membership = await this.repository.createMembership({ id: randomUUID(), storeId: store.id, userId, roleCode: 'OWNER' }, executor);
    return { store, membership };
  }
}

function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function isConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error.code === 'CONFLICT' || error.code === '23505');
}
