#!/usr/bin/env node
// pnpm dev:all — local database + API + web (+ landing with --landing).
// The root .env.local (gitignored) holds the owner's keys; every integration without a key runs in mock mode.
// Auth and database, first match wins:
//   1. SUPABASE_URL + SUPABASE_ANON_KEY in .env.local: Auth of that Supabase project. With DATABASE_URL, its
//      database too; without it, the embedded Postgres on :54322 (users copied into the auth.users stub).
//   2. Docker: Supabase CLI (Postgres + Auth).
//   3. Embedded Postgres on :54322 and the API's dev auth (AUTH_MODE=dev).
// --embedded ignores .env.local and Docker: option 3 with every integration in mock mode (used by the e2e).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const win = process.platform === 'win32';
const args = new Set(process.argv.slice(2));
const withLanding = args.has('--landing');
const forceEmbedded = args.has('--embedded');
const children = [];
let startedEmbeddedDb = false;

const COLORS = { db: 36, api: 35, web: 32, landing: 33, dev: 90 };
const log = (tag, msg) => process.stdout.write(`\x1b[${COLORS[tag] ?? 37}m[${tag}]\x1b[0m ${msg}\n`);

function run(tag, cmd, cmdArgs, opts = {}) {
  const child = spawn(cmd, cmdArgs, {
    cwd: root,
    shell: win,
    env: { ...process.env, ...opts.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const pipe = stream =>
    stream.on('data', buf => {
      for (const line of buf.toString().split(/\r?\n/)) if (line.trim()) log(tag, line);
    });
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('exit', code => log(tag, `exited with code ${code}`));
  children.push(child);
  return child;
}

function shutdown() {
  log('dev', 'stopping…');
  for (const c of children) {
    if (c.exitCode === null) {
      if (win) spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
      else c.kill('SIGINT');
    }
  }
  // The embedded Postgres runs detached from Gradle: stop it explicitly.
  if (startedEmbeddedDb)
    spawnSync(gradle, ['--console=plain', ':apps:api:localDbStop'], {
      cwd: root,
      stdio: 'ignore',
      shell: win,
      env: { ...process.env, ...(JAVA_HOME ? { JAVA_HOME } : {}) },
    });
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const portOpen = (port, host = '127.0.0.1') =>
  new Promise(resolve => {
    const s = createConnection({ port, host });
    s.once('connect', () => (s.end(), resolve(true)));
    s.once('error', () => resolve(false));
  });

async function waitFor(check, label, timeoutMs = 240_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise(r => setTimeout(r, 1500));
  }
  throw new Error(`timeout waiting for ${label}`);
}

function javaHome() {
  if (process.env.JAVA_HOME) return process.env.JAVA_HOME;
  const jdks = join(homedir(), '.jdks');
  if (existsSync(jdks)) {
    const jdk = readdirSync(jdks)
      .filter(d => /^(jdk-|temurin-)?21/.test(d) || d.startsWith('jdk-21'))
      .sort()
      .pop();
    if (jdk) return join(jdks, jdk);
  }
  return undefined;
}

function dockerAvailable() {
  if (forceEmbedded) return false;
  // A broken Docker Desktop can keep `docker info` waiting for a long time: give up after 10 s.
  const r = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
    encoding: 'utf8',
    shell: win,
    timeout: 10_000,
  });
  return r.status === 0 && /\d/.test(r.stdout);
}

function supabaseEnv() {
  const r = spawnSync('npx', ['supabase', 'status', '-o', 'env', '--workdir', 'infra'], {
    cwd: root,
    encoding: 'utf8',
    shell: win,
  });
  const env = {};
  for (const line of r.stdout.split(/\r?\n/)) {
    const m = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
  return env;
}

const isSet = v => !!v && !v.includes('<SEM_TOKEN>') && !v.includes('<PREENCHER>');

/** KEY=value lines of a dotenv file; quotes and trailing " # comments" are stripped, placeholders dropped. */
function readEnvFile(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const quoted = /^(["'])(.*?)\1/.exec(m[2]);
    const value = quoted ? quoted[2] : m[2].replace(/\s+#.*$/, '').trim();
    if (isSet(value)) out[m[1]] = value;
  }
  return out;
}

/** New projects sign tokens with asymmetric keys (JWKS); older ones need the legacy JWT secret. */
async function checkSupabaseKeys(url) {
  try {
    const r = await fetch(`${url}/auth/v1/.well-known/jwks.json`);
    const body = r.ok ? await r.json() : null;
    if (!body?.keys?.length && !secrets.SUPABASE_JWT_SECRET)
      log(
        'dev',
        'Supabase signs tokens with the legacy JWT secret: put SUPABASE_JWT_SECRET in .env.local or migrate to JWT signing keys in the dashboard.',
      );
  } catch {
    log('dev', `could not read the Supabase JWKS at ${url} — check SUPABASE_URL in .env.local`);
  }
}

async function startEmbeddedDb() {
  if (await portOpen(54322)) return;
  run('db', gradle, ['--console=plain', ':apps:api:localDb'], { env: apiEnv });
  startedEmbeddedDb = true;
  await waitFor(() => portOpen(54322), 'embedded Postgres');
}

function writeWebEnv(vars) {
  const file = join(root, 'apps', 'web', '.env.local');
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  writeFileSync(file, `# Generated by pnpm dev:all — local only, not versioned.\n${body}\n`);
}

const gradle = win ? join(root, 'gradlew.bat') : './gradlew';
const JAVA_HOME = javaHome();
if (!JAVA_HOME) log('dev', 'JAVA_HOME not set and no JDK 21 found in ~/.jdks — the API needs Java 21.');

// Owner keys: API variables pass through as they are, VITE_* go to the web. Supabase and database keys are
// handled below, only together with the real Supabase Auth.
const secrets = forceEmbedded ? {} : readEnvFile(join(root, '.env.local'));
const SUPABASE_KEYS = new Set(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DATABASE_URL', 'DATABASE_DIRECT_URL']);
const passThrough = Object.fromEntries(
  Object.entries(secrets).filter(([k]) => !SUPABASE_KEYS.has(k) && !k.startsWith('VITE_')),
);
const webExtra = Object.fromEntries(Object.entries(secrets).filter(([k]) => k.startsWith('VITE_')));

const apiEnv = {
  SPRING_PROFILES_ACTIVE: 'local',
  PORT: '8080',
  APP_URL: 'http://localhost:5173',
  API_URL: 'http://localhost:8080',
  WEB_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  DATABASE_DIRECT_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  ...passThrough,
  ...(JAVA_HOME ? { JAVA_HOME } : {}),
};
const webEnv = {
  VITE_API_URL: 'http://localhost:8080',
  VITE_SUPABASE_URL: '<SEM_TOKEN>',
  VITE_SUPABASE_ANON_KEY: '<SEM_TOKEN>',
};

if (secrets.SUPABASE_URL && secrets.SUPABASE_ANON_KEY) {
  const url = secrets.SUPABASE_URL.replace(/\/+$/, '');
  // A DATABASE_URL on this machine (the example's 127.0.0.1:54322) means the embedded database.
  const remoteDb = !!secrets.DATABASE_URL && !/@(127\.0\.0\.1|localhost)[:/]/.test(secrets.DATABASE_URL);
  log(
    'db',
    `.env.local: Supabase Auth at ${url}; database: ${remoteDb ? 'the Supabase project' : 'embedded Postgres on :54322'}`,
  );
  await checkSupabaseKeys(url);
  if (remoteDb) {
    if (!secrets.DATABASE_DIRECT_URL) log('db', 'DATABASE_DIRECT_URL not set: migrations go through DATABASE_URL');
    Object.assign(apiEnv, {
      DATABASE_URL: secrets.DATABASE_URL,
      DATABASE_DIRECT_URL: secrets.DATABASE_DIRECT_URL ?? secrets.DATABASE_URL,
    });
  } else {
    await startEmbeddedDb();
  }
  Object.assign(apiEnv, {
    AUTH_MODE: 'supabase',
    DB_AUTH_STUB: remoteDb ? 'false' : 'true',
    DB_MIRROR_AUTH_USERS: remoteDb ? 'false' : 'true',
    SUPABASE_URL: url,
    SUPABASE_JWKS_URL: `${url}/auth/v1/.well-known/jwks.json`,
  });
  Object.assign(webEnv, { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: secrets.SUPABASE_ANON_KEY });
} else if (dockerAvailable()) {
  log('db', 'Docker found: starting Supabase local (Postgres + Auth)…');
  const r = spawnSync('npx', ['supabase', 'start', '--workdir', 'infra'], { cwd: root, stdio: 'inherit', shell: win });
  if (r.status !== 0) throw new Error('supabase start failed');
  const s = supabaseEnv();
  Object.assign(apiEnv, {
    AUTH_MODE: 'supabase',
    DB_AUTH_STUB: 'false',
    SUPABASE_URL: s.API_URL,
    SUPABASE_JWKS_URL: `${s.API_URL}/auth/v1/.well-known/jwks.json`,
    ...(s.JWT_SECRET ? { SUPABASE_JWT_SECRET: s.JWT_SECRET } : {}),
    ...(s.SERVICE_ROLE_KEY ? { SUPABASE_SERVICE_ROLE_KEY: s.SERVICE_ROLE_KEY } : {}),
  });
  Object.assign(webEnv, { VITE_SUPABASE_URL: s.API_URL, VITE_SUPABASE_ANON_KEY: s.ANON_KEY ?? s.PUBLISHABLE_KEY });
} else {
  log(
    'db',
    `${forceEmbedded ? '--embedded' : 'Docker not available'}: starting the embedded Postgres on :54322 (dev auth mode)…`,
  );
  await startEmbeddedDb();
  Object.assign(apiEnv, { AUTH_MODE: 'dev', DB_AUTH_STUB: 'true' });
}
writeWebEnv({ ...webEnv, ...webExtra });
log('db', 'database ready');

run('api', gradle, ['--console=plain', ':apps:api:bootRun'], { env: apiEnv });
await waitFor(
  async () => {
    try {
      return (await fetch('http://localhost:8080/actuator/health')).ok;
    } catch {
      return false;
    }
  },
  'API health',
  360_000,
);
log('api', 'ready at http://localhost:8080 (Swagger: /swagger-ui/index.html)');

run('web', 'pnpm', ['--filter', '@qr/web', 'dev']);
if (withLanding) run('landing', 'pnpm', ['--filter', '@qr/landing', 'dev']);
log('dev', 'web on http://localhost:5173 — Ctrl+C stops everything');
