import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadApiConfig } from '@commerce/config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const config = loadApiConfig(process.env);
  const app = await NestFactory.create(AppModule);
  await app.listen(config.API_PORT);
}

void bootstrap().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'API startup failed'}\n`);
  process.exitCode = 1;
});
