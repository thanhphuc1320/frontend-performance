export type RepositoryErrorCode = 'NOT_FOUND' | 'CONFLICT' | 'MAX_DEPTH_EXCEEDED' | 'TAG_IN_USE' | 'INVALID_STATUS_TRANSITION';

export class RepositoryError extends Error {
  constructor(public readonly code: RepositoryErrorCode, message: string) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export function mapConflict(error: unknown, message: string): never {
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
    throw new RepositoryError('CONFLICT', message);
  }
  throw error;
}
