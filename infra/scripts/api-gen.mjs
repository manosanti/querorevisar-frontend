#!/usr/bin/env node
// pnpm api:gen — downloads /v3/api-docs from the local API (or reads a snapshot file), checks it against the
// contract (packages/api-client/openapi.yaml) and regenerates packages/api-client with orval.
//   pnpm api:gen                      # API running on http://localhost:8080
//   pnpm api:gen --from apps/api/build/openapi.json
// CI runs it and fails when the contract drifted or the generated client differs from the committed one.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const win = process.platform === 'win32';
const pkg = join(root, 'packages', 'api-client');
const argv = process.argv.slice(2);
const from = argv.includes('--from') ? argv[argv.indexOf('--from') + 1] : null;
const apiUrl = process.env.API_URL ?? 'http://localhost:8080';

let target = from ? join(root, from) : null;
if (!target) {
  const res = await fetch(`${apiUrl}/v3/api-docs`).catch(() => null);
  if (!res?.ok) {
    console.error(`Could not read ${apiUrl}/v3/api-docs. Start the API (pnpm dev:all) or pass --from <file>.`);
    process.exit(1);
  }
  target = join(pkg, 'openapi.live.json');
  writeFileSync(target, JSON.stringify(await res.json(), null, 2) + '\n');
}

const step = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: win });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

step('node', ['scripts/compare-contract.ts', target], pkg);
step('pnpm', ['exec', 'orval', '--config', './orval.config.ts'], pkg);
console.log('api-client regenerated from the contract; the live API matches it.');
