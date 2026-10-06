import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderThemeCss, renderTokensCss } from './render.ts';

const dir = import.meta.dirname;
// Checkouts with core.autocrlf=true may turn LF into CRLF; compare content, not line endings.
const read = (name: string) => readFileSync(join(dir, name), 'utf8').split(String.fromCharCode(13)).join('');

describe('tokens', () => {
  it('tokens.css is up to date with src/index.ts', () => {
    expect(read('tokens.css')).toBe(renderTokensCss());
  });

  it('theme.css is up to date with src/index.ts', () => {
    expect(read('theme.css')).toBe(renderThemeCss());
  });
});
