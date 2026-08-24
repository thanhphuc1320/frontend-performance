import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { IdentityService } from '../src/identity/application/identity.service';
import { StoreService } from '../src/stores/application/store.service';

describe('auth and Store foundation', () => {
  it('exposes generic registration and safe verification responses', async () => {
    const identity = {
      register: jest.fn(async () => ({ accepted: true as const })),
      verifyEmail: jest.fn(async () => ({ verified: true })),
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(IdentityService).useValue(identity)
      .overrideProvider(StoreService).useValue({})
      .compile();
    const app = module.createNestApplication();
    await app.init();

    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: 'person@example.com', password: 'a secure password' }).expect(201).expect({ accepted: true });
    await request(app.getHttpServer()).post('/api/v1/auth/verify-email').send({ token: 'opaque-token' }).expect(201).expect({ verified: true });
    expect(identity.register).toHaveBeenCalled();
    expect(identity.verifyEmail).toHaveBeenCalledWith('opaque-token');
    await app.close();
  });
});
