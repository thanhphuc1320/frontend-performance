import { ApiError, mapApiError } from './api-error';

describe('API errors', () => {
  it('maps expected domain failures to the response envelope', () => {
    expect(mapApiError(new ApiError(400, 'VALIDATION_ERROR', 'Invalid request'), 'request-1')).toEqual({
      status: 400,
      body: { error: { code: 'VALIDATION_ERROR', message: 'Invalid request', requestId: 'request-1' } },
    });
  });
});
