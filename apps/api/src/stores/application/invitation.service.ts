import { Inject } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { RequestContext } from '../../auth/application/session.service';
import { ApiError } from '../../http/api-error';
import { ROLE_CODES, type RoleCode } from '../../authorization/domain/permission';
import { STORE_REPOSITORY } from './store.tokens';
import { IDENTITY_REPOSITORY, EMAIL_DELIVERY } from '../../identity/application/identity.tokens';

export type MembershipRecord = { id: string; storeId: string; userId: string; roleCode: string; status: string };
export type StoreRecord = { id: string; status: 'ACTIVE' | 'DEACTIVATED' };
export type InvitationRecord = { id: string; storeId: string; email: string; roleCode: string; tokenHash: string; status: string; expiresAt: Date; consumedAt: Date | null; revokedAt: Date | null };

export type InvitationRepository = {
  transaction<T>(work: (executor: unknown) => Promise<T>): Promise<T>;
  findStoreById(storeId: string, executor?: unknown): Promise<StoreRecord | null>;
  findMembership(storeId: string, userId: string, executor?: unknown): Promise<MembershipRecord | null>;
  createMembership(input: { id: string; storeId: string; userId: string; roleCode: string; status?: string }, executor?: unknown): Promise<MembershipRecord>;
  updateMembershipStatus(membershipId: string, status: string, executor?: unknown): Promise<MembershipRecord>;
  updateMembershipRole(membershipId: string, roleCode: string, executor?: unknown): Promise<MembershipRecord>;
  createInvitation(input: { id: string; storeId: string; inviterUserId: string; email: string; roleCode: string; tokenHash: string; expiresAt: Date }, executor?: unknown): Promise<InvitationRecord>;
  findInvitationByTokenHash(tokenHash: string, executor?: unknown): Promise<InvitationRecord | null>;
  findInvitationById(invitationId: string, executor?: unknown): Promise<InvitationRecord | null>;
  revokeInvitation(invitationId: string, executor?: unknown): Promise<InvitationRecord>;
  consumeInvitation(tokenHash: string, executor?: unknown): Promise<boolean>;
};

export type IdentityStore = {
  findUserById(id: string): Promise<{ id: string; email: string; status: string } | null>;
  findUserByEmail(email: string): Promise<{ id: string; email: string; status: string } | null>;
};

export type EmailDelivery = {
  sendInvitation(message: { recipient: string; actionUrl: string; templateData: Record<string, string> }): Promise<void>;
};

const MANAGING_ROLES: readonly string[] = ['OWNER', 'ADMIN'];
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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

function assertValidRoleCode(roleCode: string): asserts roleCode is RoleCode {
  if (!ROLE_CODES.includes(roleCode as RoleCode)) {
    throw new ApiError(400, 'INVALID_ROLE_CODE', `Invalid role code: ${roleCode}`);
  }
}

export class InvitationService {
  constructor(
    @Inject(STORE_REPOSITORY)
    private readonly repository: InvitationRepository,
    @Inject(IDENTITY_REPOSITORY)
    private readonly identity: IdentityStore,
    @Inject(EMAIL_DELIVERY)
    private readonly emailDelivery: EmailDelivery,
  ) {}

  async invite(context: RequestContext, storeId: string, email: string, roleCode: RoleCode): Promise<InvitationRecord> {
    assertValidRoleCode(roleCode);
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const invitation = await this.repository.transaction(async (executor) => {
      const store = await this.repository.findStoreById(storeId, executor);
      assertStoreActive(store);
      const actorMembership = await this.repository.findMembership(storeId, context.userId, executor);
      assertCanManage(actorMembership);
      return this.repository.createInvitation({
        id: randomUUID(),
        storeId,
        inviterUserId: context.userId,
        email: email.toLowerCase().trim(),
        roleCode,
        tokenHash,
        expiresAt,
      }, executor);
    });

    await this.emailDelivery.sendInvitation({
      recipient: email,
      actionUrl: `/invitations/accept?token=${rawToken}`,
      templateData: { email, storeId, roleCode },
    });

    return invitation;
  }

  async resend(context: RequestContext, storeId: string, invitationId: string): Promise<InvitationRecord> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    const invitation = await this.repository.transaction(async (executor) => {
      const store = await this.repository.findStoreById(storeId, executor);
      assertStoreActive(store);
      const actorMembership = await this.repository.findMembership(storeId, context.userId, executor);
      assertCanManage(actorMembership);
      const existing = await this.repository.findInvitationById(invitationId, executor);
      if (!existing || existing.storeId !== storeId) {
        throw new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
      }
      if (existing.status !== 'PENDING') {
        throw new ApiError(400, 'INVITATION_NOT_PENDING', 'Invitation is not pending');
      }
      await this.repository.revokeInvitation(invitationId, executor);
      return this.repository.createInvitation({
        id: randomUUID(),
        storeId,
        inviterUserId: context.userId,
        email: existing.email,
        roleCode: existing.roleCode as RoleCode,
        tokenHash,
        expiresAt,
      }, executor);
    });

    await this.emailDelivery.sendInvitation({
      recipient: invitation.email,
      actionUrl: `/invitations/accept?token=${rawToken}`,
      templateData: { email: invitation.email, storeId, roleCode: invitation.roleCode },
    });

    return invitation;
  }

  async revoke(context: RequestContext, storeId: string, invitationId: string): Promise<InvitationRecord> {
    return this.repository.transaction(async (executor) => {
      const store = await this.repository.findStoreById(storeId, executor);
      assertStoreActive(store);
      const actorMembership = await this.repository.findMembership(storeId, context.userId, executor);
      assertCanManage(actorMembership);
      const existing = await this.repository.findInvitationById(invitationId, executor);
      if (!existing || existing.storeId !== storeId) {
        throw new ApiError(404, 'INVITATION_NOT_FOUND', 'Invitation not found');
      }
      if (existing.status !== 'PENDING') {
        throw new ApiError(400, 'INVITATION_NOT_PENDING', 'Invitation is not pending');
      }
      return this.repository.revokeInvitation(invitationId, executor);
    });
  }

  async accept(rawToken: string, userId: string): Promise<{ membership: MembershipRecord }> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    return this.repository.transaction(async (executor) => {
      const invitation = await this.repository.findInvitationByTokenHash(tokenHash, executor);
      if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt <= new Date() || invitation.revokedAt !== null) {
        throw new ApiError(400, 'INVITATION_INVALID', 'Invitation is invalid or expired');
      }
      const store = await this.repository.findStoreById(invitation.storeId, executor);
      assertStoreActive(store);
      const user = await this.identity.findUserById(userId);
      if (!user || user.status !== 'ACTIVE') {
        throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication required');
      }
      if (user.email.toLowerCase().trim() !== invitation.email.toLowerCase().trim()) {
        throw new ApiError(403, 'INVITATION_EMAIL_MISMATCH', 'Invitation email does not match your account');
      }
      const consumed = await this.repository.consumeInvitation(tokenHash, executor);
      if (!consumed) {
        throw new ApiError(400, 'INVITATION_INVALID', 'Invitation is invalid or expired');
      }
      const existingMembership = await this.repository.findMembership(invitation.storeId, userId, executor);
      if (existingMembership) {
        if (existingMembership.status === 'LEFT' || existingMembership.status === 'REMOVED') {
          await this.repository.updateMembershipStatus(existingMembership.id, 'ACTIVE', executor);
          const updated = await this.repository.updateMembershipRole(existingMembership.id, invitation.roleCode, executor);
          return { membership: updated };
        }
        if (existingMembership.status === 'ACTIVE' || existingMembership.status === 'SUSPENDED' || existingMembership.status === 'INVITED') {
          return { membership: existingMembership };
        }
      }
      const membership = await this.repository.createMembership({
        id: randomUUID(),
        storeId: invitation.storeId,
        userId,
        roleCode: invitation.roleCode,
        status: 'ACTIVE',
      }, executor);
      return { membership };
    });
  }
}
