import { Membership } from './membership';

describe('Membership domain invariants', () => {
  it('allows ACTIVE to SUSPENDED, LEFT, REMOVED', () => {
    const m = new Membership('m1', 's1', 'u1', 'OWNER', 'ACTIVE');
    expect(m.canTransitionTo('SUSPENDED')).toBe(true);
    expect(m.canTransitionTo('LEFT')).toBe(true);
    expect(m.canTransitionTo('REMOVED')).toBe(true);
  });

  it('allows SUSPENDED to ACTIVE and REMOVED', () => {
    const m = new Membership('m1', 's1', 'u1', 'OWNER', 'SUSPENDED');
    expect(m.canTransitionTo('ACTIVE')).toBe(true);
    expect(m.canTransitionTo('REMOVED')).toBe(true);
    expect(m.canTransitionTo('LEFT')).toBe(false);
  });

  it('allows INVITED to ACTIVE, LEFT, REMOVED', () => {
    const m = new Membership('m1', 's1', 'u1', 'STAFF', 'INVITED');
    expect(m.canTransitionTo('ACTIVE')).toBe(true);
    expect(m.canTransitionTo('LEFT')).toBe(true);
    expect(m.canTransitionTo('REMOVED')).toBe(true);
  });

  it('makes LEFT and REMOVED terminal', () => {
    const left = new Membership('m1', 's1', 'u1', 'STAFF', 'LEFT');
    expect(left.canTransitionTo('ACTIVE')).toBe(false);
    expect(left.canTransitionTo('SUSPENDED')).toBe(false);

    const removed = new Membership('m2', 's1', 'u2', 'STAFF', 'REMOVED');
    expect(removed.canTransitionTo('ACTIVE')).toBe(false);
    expect(removed.canTransitionTo('SUSPENDED')).toBe(false);
  });

  it('rejects invalid transitions', () => {
    const m = new Membership('m1', 's1', 'u1', 'OWNER', 'ACTIVE');
    expect(m.canTransitionTo('INVITED')).toBe(false);
    expect(m.canTransitionTo('ACTIVE')).toBe(false);
  });
});
