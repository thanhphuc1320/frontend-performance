const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const repositoryEnvFile = join(__dirname, '..', '.env');

function loadRepositoryEnv(environment = process.env, envFile = repositoryEnvFile) {
  let contents;
  try {
    contents = readFileSync(envFile, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return environment;
    throw error;
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;

    const [, name, rawValue] = match;
    const value = unquote(rawValue);
    if (environment[name] === undefined) environment[name] = value;
  }

  return environment;
}

function unquote(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value.replace(/\s+#.*$/, '');
}

module.exports = { loadRepositoryEnv };

loadRepositoryEnv();
