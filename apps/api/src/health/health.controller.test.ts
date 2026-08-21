import { Test } from '@nestjs/testing';
import { HealthController, REQUEST_ID_PROVIDER } from './health.controller';

describe('HealthController', () => {
  it('returns an ok status with the request ID supplied by the boundary provider', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: REQUEST_ID_PROVIDER,
          useValue: () => 'test-request-id',
        },
      ],
    }).compile();

    const response = moduleRef.get(HealthController).getHealth();

    expect(response).toEqual({
      status: 'ok',
      requestId: 'test-request-id',
    });
  });
});
