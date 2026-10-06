// Compares the hand-written contract (openapi.yaml) with an OpenAPI document produced by the API
// (springdoc /v3/api-docs). Usage:
//   node scripts/compare-contract.ts <target.json|url> [--contract openapi.yaml]
// Exits 1 when an operation, schema, property, required flag, enum or type differs.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

type Json = Record<string, unknown>;
type Schema = Json & {
  $ref?: string;
  type?: string | string[];
  format?: string;
  enum?: unknown[];
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  nullable?: boolean;
  oneOf?: Schema[];
  anyOf?: Schema[];
  allOf?: Schema[];
};
interface Doc {
  paths: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, Schema> };
}

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const targetArg = args.find(a => !a.startsWith('--'));
const contractPath = args.includes('--contract')
  ? args[args.indexOf('--contract') + 1]!
  : join(here, '..', 'openapi.yaml');
if (!targetArg) {
  console.error('usage: node scripts/compare-contract.ts <target.json|url> [--contract openapi.yaml]');
  process.exit(2);
}

const contract = parse(readFileSync(contractPath, 'utf8')) as Doc;
const target: Doc = targetArg.startsWith('http')
  ? ((await (await fetch(targetArg)).json()) as Doc)
  : (JSON.parse(readFileSync(targetArg, 'utf8')) as Doc);

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const diffs: string[] = [];

// ---- operations --------------------------------------------------------------------------------
const ops = (d: Doc) =>
  new Set(
    Object.entries(d.paths).flatMap(([p, item]) =>
      METHODS.filter(m => m in item).map(m => `${m.toUpperCase()} ${p.replace(/\{[^}]+\}/g, '{}')}`),
    ),
  );
const cOps = ops(contract);
const tOps = ops(target);
for (const op of cOps) if (!tOps.has(op)) diffs.push(`missing operation: ${op}`);
for (const op of tOps) if (!cOps.has(op)) diffs.push(`extra operation (not in contract): ${op}`);

// ---- schemas -----------------------------------------------------------------------------------
function resolve(doc: Doc, s: Schema | undefined): Schema | undefined {
  let cur = s;
  for (let i = 0; i < 5 && cur?.$ref; i++) cur = doc.components?.schemas?.[cur.$ref.split('/').pop()!];
  return cur;
}

/** A comparable description: kind (string/integer/...), format, nullable, enum and item kind. */
function describe(doc: Doc, raw: Schema | undefined): string {
  if (!raw) return 'undefined';
  const variants = raw.oneOf ?? raw.anyOf;
  let nullable = raw.nullable === true;
  let s = raw;
  if (variants) {
    const nonNull = variants.filter(v => v.type !== 'null');
    nullable = nullable || nonNull.length < variants.length;
    s = nonNull.length === 1 ? nonNull[0]! : raw;
  }
  if (s.allOf?.length === 1) s = s.allOf[0]!;
  const refName = s.$ref?.split('/').pop();
  const r = resolve(doc, s) ?? s;
  const types = Array.isArray(r.type) ? r.type : r.type ? [r.type] : [];
  if (types.includes('null')) nullable = true;
  const kind = types.filter(t => t !== 'null')[0] ?? (r.properties ? 'object' : refName ? 'object' : 'any');
  const enumPart = r.enum
    ? `enum(${[...r.enum]
        .filter(v => v !== null)
        .sort()
        .join('|')})`
    : '';
  const items = kind === 'array' ? `<${describe(doc, r.items)}>` : '';
  const objRef = kind === 'object' && refName && !r.enum ? `#${refName}` : '';
  const format = r.format && r.format !== 'int32' && r.format !== 'int64' ? `:${r.format}` : '';
  return `${kind}${format}${enumPart}${items}${objRef}${nullable ? '?' : ''}`;
}

const cSchemas = contract.components?.schemas ?? {};
const tSchemas = target.components?.schemas ?? {};
for (const [name, cs] of Object.entries(cSchemas)) {
  if (!cs.properties) continue; // enums and aliases are compared where they are used
  const ts = tSchemas[name];
  if (!ts) {
    diffs.push(`missing schema: ${name}`);
    continue;
  }
  const tsr = resolve(target, ts) ?? ts;
  const cProps = Object.keys(cs.properties);
  const tProps = Object.keys(tsr.properties ?? {});
  for (const p of cProps) if (!tProps.includes(p)) diffs.push(`${name}.${p}: missing property`);
  for (const p of tProps) if (!cProps.includes(p)) diffs.push(`${name}.${p}: extra property (not in contract)`);
  const cReq = new Set(cs.required ?? []);
  const tReq = new Set(tsr.required ?? []);
  for (const p of cProps) {
    if (!tProps.includes(p)) continue;
    if (cReq.has(p) !== tReq.has(p))
      diffs.push(`${name}.${p}: required ${cReq.has(p)} in contract, ${tReq.has(p)} in API`);
    const a = describe(contract, cs.properties[p]);
    const b = describe(target, tsr.properties![p]);
    if (a !== b) diffs.push(`${name}.${p}: contract ${a} vs API ${b}`);
  }
}

if (diffs.length) {
  console.error(`Contract drift (${diffs.length}):`);
  for (const d of diffs) console.error('  - ' + d);
  process.exit(1);
}
console.log(`Contract OK: ${cOps.size} operations, ${Object.keys(cSchemas).length} schemas match.`);
