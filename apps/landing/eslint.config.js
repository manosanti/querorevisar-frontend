// Shared monorepo config plus Astro component linting and accessibility rules (jsx-a11y via eslint-plugin-astro).
import base from '@qr/config/eslint';
import astro from 'eslint-plugin-astro';

export default [
  ...base,
  ...astro.configs['flat/recommended'],
  ...astro.configs['flat/jsx-a11y-recommended'],
  { ignores: ['.astro/**', 'dist/**'] },
];
