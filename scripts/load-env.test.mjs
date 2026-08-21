import { strict as assert } from 'node:assert';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import loader from './load-env.cjs';

const { loadRepositoryEnv } = loader;

describe('loadRepositoryEnv', () => {
  it('loads .env values without overriding explicitly exported values', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'commerce-env-'));
    const envFile = join(directory, '.env');
    await writeFile(envFile, 'FROM_FILE=file-value\nEXPLICIT=file-value\nSECRET=do-not-log\n');
    const env = { EXPLICIT: 'exported-value' };

    loadRepositoryEnv(env, envFile);

    assert.equal(env.FROM_FILE, 'file-value');
    assert.equal(env.EXPLICIT, 'exported-value');
    assert.equal(env.SECRET, 'do-not-log');
  });

  it('does nothing when the repository .env is absent', async () => {
    const env = {};

    loadRepositoryEnv(env, '/tmp/commerce-env-file-that-does-not-exist');

    assert.deepEqual(env, {});
  });
});
