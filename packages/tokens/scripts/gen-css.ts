// Regenerates src/tokens.css and src/theme.css from src/index.ts.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTokensCss, renderThemeCss } from '../src/render.ts';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
writeFileSync(join(srcDir, 'tokens.css'), renderTokensCss());
writeFileSync(join(srcDir, 'theme.css'), renderThemeCss());
console.log('tokens.css and theme.css regenerated');
