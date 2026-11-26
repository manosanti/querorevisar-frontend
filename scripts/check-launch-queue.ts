// Launch queue check (docs/fila-de-lancamento.md).
// Every name the deploy reads must be written in the queue as `NAME`: the GitHub vars/secrets, the Cloud Run
// env-vars file keys (the jq block between `# env-vars:begin` and `# env-vars:end`), the --set-secrets keys and the
// Secret Manager names, all taken from .github/workflows.
// Prints the queue progress. With --final it also fails while any item is still open.
// Usage: node scripts/check-launch-queue.ts [--final]
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE = 'docs/fila-de-lancamento.md';
const final = process.argv.includes('--final');

const workflowsDir = join(root, '.github/workflows');
const workflows = readdirSync(workflowsDir)
  .filter(name => /\.ya?ml$/.test(name))
  .map(name => readFileSync(join(workflowsDir, name), 'utf8'))
  .join('\n');

const needed = new Set<string>();
for (const [, name] of workflows.matchAll(/\b(?:vars|secrets)\.([A-Z][A-Z0-9_]*)/g)) needed.add(name);
for (const [, block] of workflows.matchAll(/# env-vars:begin\n([\s\S]*?)# env-vars:end/g)) {
  for (const [, name] of (block ?? '').matchAll(/^\s+([A-Z][A-Z0-9_]*):\s/gm)) needed.add(name ?? '');
}
for (const [, list] of workflows.matchAll(/--set-(?:env-vars|secrets)=(.+?)\s*\\?$/gm)) {
  for (const pair of list.split(',')) {
    const [key = '', value = ''] = pair.split(/=(.*)/s, 2).map(part => part.trim());
    if (/^[A-Z][A-Z0-9_]*$/.test(key)) needed.add(key);
    const secret = /^(qr-[a-z0-9-]+):/.exec(value);
    if (secret) needed.add(secret[1]);
  }
}

const doc = readFileSync(join(root, QUEUE), 'utf8');
const written = new Set([...doc.matchAll(/`([^`\n]+)`/g)].map(([, code]) => code.trim()));
const missing = [...needed].filter(name => !written.has(name)).sort();

const open = doc.match(/^\s*- \[ \]/gm)?.length ?? 0;
const done = doc.match(/^\s*- \[x\]/gim)?.length ?? 0;

console.log(`${QUEUE}: ${done} de ${open + done} itens feitos.`);
if (missing.length > 0) {
  console.error(`Os workflows leem nomes que a fila não lista (acrescente no Anexo B): ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`Cobertura ok: a fila lista os ${needed.size} nomes que os workflows leem.`);
if (final && open > 0) {
  console.error(`Ainda há ${open} itens abertos.`);
  process.exit(1);
}
