// F02.1 acceptance: no hex/rgb color literal outside packages/tokens.
// Scans source files of apps/ and packages/ and fails when a raw color is found.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const scanDirs = ['apps/web/src', 'apps/landing/src', 'packages/ui/src'];
const exts = ['.ts', '.tsx', '.css', '.astro', '.html'];
const skip = ['node_modules', 'dist', 'generated', '.astro'];
const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(/g;

const offenders: string[] = [];

function walk(dir: string): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (skip.includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (exts.some(e => name.endsWith(e))) check(full);
  }
}

function check(file: string): void {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // Allow `#` ids/anchors like href="#termos" by requiring a hex-looking token after '#'.
    for (const m of line.matchAll(COLOR)) {
      const before = line.slice(Math.max(0, (m.index ?? 0) - 6), m.index);
      if (/href=["']?$|url\(["']?$/.test(before)) continue;
      offenders.push(`${relative(root, file)}:${i + 1}: ${line.trim()}`);
    }
  });
}

for (const d of scanDirs) walk(join(root, d));

if (offenders.length) {
  console.error('Raw colors found outside packages/tokens (use the design tokens instead):');
  for (const o of offenders) console.error('  ' + o);
  process.exit(1);
}
console.log('check:colors ok');
