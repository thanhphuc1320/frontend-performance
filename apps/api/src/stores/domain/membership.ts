export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'LEFT' | 'REMOVED' | 'INVITED';

export class Membership {
  constructor(
    public readonly id: string,
    public readonly storeId: string,
    public readonly userId: string,
    public readonly roleCode: string,
    public readonly status: MembershipStatus,
  ) {}

  static validTransition(from: MembershipStatus, to: MembershipStatus): boolean {
    const transitions: Record<MembershipStatus, readonly MembershipStatus[]> = {
      INVITED: ['ACTIVE', 'LEFT', 'REMOVED'],
      ACTIVE: ['SUSPENDED', 'LEFT', 'REMOVED'],
      SUSPENDED: ['ACTIVE', 'REMOVED'],
      LEFT: [],
      REMOVED: [],
    };
    return transitions[from].includes(to);
  }

  canTransitionTo(status: MembershipStatus): boolean {
    return Membership.validTransition(this.status, status);
  }
}
