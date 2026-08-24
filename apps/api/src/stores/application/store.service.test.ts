import { User, UserStatus } from '../../identity/domain/user';
import { StoreService } from './store.service';

describe('StoreService', () => {
  function setup(status = UserStatus.ACTIVE) {
    const user = new User('user-1', 'owner@example.com', 'hash', status);
    const store = { id: 'store-1', name: 'My Store', timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', status: 'ACTIVE' as const, createdBy: user.id };
    type TestRepository = {
      transaction: jest.Mock;
      createStore: jest.Mock;
      createMembership: jest.Mock;
      listForUser: jest.Mock;
      findMembership: jest.Mock;
    };
    const repository: TestRepository = {
      transaction: jest.fn(async <T>(work: (tx: unknown) => Promise<T>): Promise<T> => work(repository)),
      createStore: jest.fn(async () => store),
      createMembership: jest.fn(async () => ({ id: 'membership-1', storeId: store.id, userId: user.id, roleCode: 'OWNER', status: 'ACTIVE' as const })),
      listForUser: jest.fn(async () => [store]),
      findMembership: jest.fn(async () => null),
    };
    const identity = { findUserById: jest.fn(async () => user) };
    return { user, store, repository, identity, service: new StoreService(repository, identity) };
  }

  it('creates the first Store and Owner membership in one transaction with safe defaults', async () => {
    const { service, repository, user } = setup();

    await expect(service.createFirstStore(user.id, { name: 'My Store' })).resolves.toMatchObject({ store: { name: 'My Store' }, membership: { roleCode: 'OWNER' } });
    expect(repository.transaction).toHaveBeenCalledTimes(1);
    expect(repository.createStore).toHaveBeenCalledWith(expect.objectContaining({ timezone: 'Asia/Ho_Chi_Minh', currency: 'VND', createdBy: user.id }), expect.anything());
    expect(repository.createMembership).toHaveBeenCalledWith(expect.objectContaining({ roleCode: 'OWNER', userId: user.id }), expect.anything());
  });

  it('rejects an unverified user before any Store mutation', async () => {
    const { service, repository, user } = setup(UserStatus.UNVERIFIED);

    await expect(service.createFirstStore(user.id, { name: 'My Store' })).rejects.toThrow('Email verification required');
    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it('propagates membership failure so the transaction can roll back the Store', async () => {
    const { service, repository, user } = setup();
    repository.createMembership.mockRejectedValueOnce(new Error('membership failed'));

    await expect(service.createFirstStore(user.id, { name: 'My Store' })).rejects.toThrow('membership failed');
    expect(repository.transaction).toHaveBeenCalledTimes(1);
  });

  it('does not accept client ownership data and lists/selects only user Stores', async () => {
    const { service, repository, user } = setup();

    await service.createFirstStore(user.id, { name: 'My Store', roleCode: 'ADMIN' } as never);
    expect(repository.createMembership).toHaveBeenCalledWith(expect.objectContaining({ roleCode: 'OWNER' }), expect.anything());
    await expect(service.listStores(user.id)).resolves.toHaveLength(1);
    await expect(service.selectStore(user.id, 'store-1')).resolves.toEqual({ storeId: 'store-1' });
  });

  it('returns the existing Store after a duplicate request without creating another membership', async () => {
    const { service, repository, user, store } = setup();
    repository.transaction.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: 'CONFLICT' }));
    repository.findMembership.mockResolvedValueOnce({ id: 'membership-1', storeId: store.id, userId: user.id, roleCode: 'OWNER', status: 'ACTIVE' });

    await expect(service.createFirstStore(user.id, { name: store.name })).resolves.toMatchObject({ store, membership: { roleCode: 'OWNER' } });
    expect(repository.createMembership).not.toHaveBeenCalled();
  });
});
