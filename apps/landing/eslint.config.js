// Shared monorepo config plus Astro component linting.
import base from '@qr/config/eslint';
import astro from 'eslint-plugin-astro';

export default [...base, ...astro.configs['flat/recommended'], { ignores: ['.astro/**', 'dist/**'] }];
