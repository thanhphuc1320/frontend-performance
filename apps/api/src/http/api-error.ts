import { HttpException, HttpStatus } from '@nestjs/common';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function mapApiError(error: unknown, requestId: string): { status: number; body: { error: { code: string; message: string; requestId: string } } } {
  if (error instanceof ApiError) return { status: error.status, body: { error: { code: error.code, message: error.message, requestId } } };
  if (error instanceof HttpException) {
    const status = error.getStatus();
    return { status, body: { error: { code: status === HttpStatus.UNAUTHORIZED ? 'UNAUTHENTICATED' : 'REQUEST_ERROR', message: status === HttpStatus.UNAUTHORIZED ? 'Authentication required' : 'Invalid request', requestId } } };
  }
  return { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId } } };
}
