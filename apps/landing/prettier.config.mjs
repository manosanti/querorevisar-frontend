// Shared monorepo Prettier options plus the Astro parser for .astro files.
// The plugin is resolved from this package, since Prettier resolves plugin names from the working directory.
import { fileURLToPath } from 'node:url';
import base from '@qr/config/prettier' with { type: 'json' };

export default {
  ...base,
  plugins: [fileURLToPath(import.meta.resolve('prettier-plugin-astro'))],
  overrides: [{ files: '*.astro', options: { parser: 'astro' } }],
};
