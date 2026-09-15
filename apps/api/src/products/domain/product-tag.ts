export interface ProductTag {
  id: string;
  storeId: string;
  name: string;
  createdAt: Date;
}

export function validateTagName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new Error('Tag name is required');
  }
  if (name.length > 50) {
    throw new Error('Tag name must be at most 50 characters');
  }
}
