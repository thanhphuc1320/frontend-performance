export type StoreStatus = 'ACTIVE' | 'DEACTIVATED';

export class Store {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly createdBy: string,
    public readonly timezone = 'Asia/Ho_Chi_Minh',
    public readonly currency = 'VND',
    public readonly status: StoreStatus = 'ACTIVE',
  ) {
    if (!name.trim()) throw new Error('Store name is required');
    if (!createdBy) throw new Error('Store creator is required');
  }
}
