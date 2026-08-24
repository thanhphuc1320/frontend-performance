import { randomUUID } from 'node:crypto';
import { UserStatus } from '../../identity/domain/user';
import type { IdentityStore } from '../../identity/application/identity.service';

type StoreRepository = {
  createStore(input: { id: string; name: string; timezone?: string; currency?: string; createdBy: string }, executor?: unknown): Promise<StoreRecord>;
  createMembership(input: { id: string; storeId: string; userId: string; roleCode: string }, executor?: unknown): Promise<MembershipRecord>;
  listForUser(userId: string): Promise<StoreRecord[]>;
  findMembership(storeId: string, userId: string): Promise<MembershipRecord | null>;
  transaction?<T>(work: (executor: unknown) => Promise<T>): Promise<T>;
};

type StoreRecord = { id: string; name: string; timezone: string; currency: string; status: 'ACTIVE' | 'DEACTIVATED'; createdBy: string };
type MembershipRecord = { id: string; storeId: string; userId: string; roleCode: string; status: string };

export class StoreService {
  constructor(
    private readonly repository: StoreRepository,
    private readonly identity: Pick<IdentityStore, 'findUserById'>,
  ) {}

  async createFirstStore(userId: string, input: { name: string; timezone?: string; currency?: string }): Promise<{ store: StoreRecord; membership: MembershipRecord }> {
    const user = await this.identity.findUserById(userId);
    if (!user || user.status !== UserStatus.ACTIVE) throw new Error('Email verification required');
    const name = input.name.trim();
    if (!name) throw new Error('Store name is required');

    try {
      return this.repository.transaction
        ? await this.repository.transaction(async (executor) => this.createStoreAndOwner(userId, { ...input, name }, executor))
        : await this.createStoreAndOwner(userId, { ...input, name }, undefined);
    } catch (error) {
      if (!isConflict(error)) throw error;
      const existing = (await this.repository.listForUser(userId)).find((store) => store.name === name);
      if (!existing) throw error;
      const membership = await this.repository.findMembership(existing.id, userId);
      if (!membership || membership.status !== 'ACTIVE' || membership.roleCode !== 'OWNER') throw error;
      return { store: existing, membership };
    }
  }

  async listStores(userId: string): Promise<StoreRecord[]> {
    await this.requireActiveUser(userId);
    return this.repository.listForUser(userId);
  }

  async selectStore(userId: string, storeId: string): Promise<{ storeId: string }> {
    await this.requireActiveUser(userId);
    const stores = await this.repository.listForUser(userId);
    if (!stores.some((store) => store.id === storeId && store.status === 'ACTIVE')) throw new Error('Store access denied');
    return { storeId };
  }

  private async requireActiveUser(userId: string): Promise<void> {
    const user = await this.identity.findUserById(userId);
    if (!user || user.status !== UserStatus.ACTIVE) throw new Error('Email verification required');
  }

  private async createStoreAndOwner(userId: string, input: { name: string; timezone?: string; currency?: string }, executor: unknown): Promise<{ store: StoreRecord; membership: MembershipRecord }> {
    const store = await this.repository.createStore({ id: randomUUID(), name: input.name, timezone: input.timezone ?? 'Asia/Ho_Chi_Minh', currency: input.currency ?? 'VND', createdBy: userId }, executor);
    const membership = await this.repository.createMembership({ id: randomUUID(), storeId: store.id, userId, roleCode: 'OWNER' }, executor);
    return { store, membership };
  }
}

function isConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error.code === 'CONFLICT' || error.code === '23505');
}
