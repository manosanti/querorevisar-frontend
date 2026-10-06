import { colors, radii, shadows, font } from './index.ts';

const HEADER = '/* Generated from src/index.ts by scripts/gen-css.ts. Do not edit by hand. */\n';

export function renderTokensCss(): string {
  const lines = [
    ...Object.entries(colors).map(([k, v]) => `  --${k}: ${v};`),
    ...Object.entries(shadows).map(([k, v]) => `  --shadow-${k}: ${v};`),
    ...Object.entries(radii).map(([k, v]) => `  --radius-${k}: ${v};`),
    `  --font-family: ${font.family};`,
  ];
  return `${HEADER}:root {\n${lines.join('\n')}\n}\n`;
}

export function renderThemeCss(): string {
  const lines = [
    '  --font-sans: var(--font-family);',
    ...Object.keys(colors).map(k => `  --color-${k}: var(--${k});`),
    ...Object.keys(shadows).map(k => `  --shadow-${k}: var(--shadow-${k});`),
    ...Object.keys(radii).map(k => `  --radius-${k}: var(--radius-${k});`),
    '  --breakpoint-tablet: 768px;',
    '  --breakpoint-desktop: 1100px;',
  ];
  return `${HEADER}@import './tokens.css';\n\n@theme inline {\n${lines.join('\n')}\n}\n`;
}
