import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..', '..');

export function readJson<T>(relPath: string): T {
  return JSON.parse(readFileSync(join(root, relPath), 'utf8')) as T;
}
