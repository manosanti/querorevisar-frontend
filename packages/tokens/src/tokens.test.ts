import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderThemeCss, renderTokensCss } from './render.ts';

const dir = import.meta.dirname;

describe('tokens', () => {
  it('tokens.css is up to date with src/index.ts', () => {
    expect(readFileSync(join(dir, 'tokens.css'), 'utf8')).toBe(renderTokensCss());
  });

  it('theme.css is up to date with src/index.ts', () => {
    expect(readFileSync(join(dir, 'theme.css'), 'utf8')).toBe(renderThemeCss());
  });
});
