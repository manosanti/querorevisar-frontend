import { fileURLToPath } from 'node:url';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, envField } from 'astro/config';
import { isNoindex } from './src/lib/seo.ts';

// `site` is needed at config time (canonical URLs, sitemap, robots.txt), before Astro loads `.env`.
try {
  process.loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)));
} catch {
  // No apps/landing/.env: fall back to the shell environment and the defaults below.
}

const DEFAULT_SITE_URL = 'http://localhost:4321';
const site = process.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL;

export default defineConfig({
  site,
  output: 'static',
  // /precos instead of /precos/ (Cloudflare Pages serves precos.html at /precos).
  build: { format: 'file' },
  trailingSlash: 'never',
  // compressHTML keeps Astro 7's default ('jsx' whitespace rules), the same rules prettier-plugin-astro formats with:
  // a space that must survive a line break is written as {' '}.
  integrations: [sitemap({ filter: page => !isNoindex(new URL(page).pathname) })],
  env: {
    schema: {
      PUBLIC_APP_URL: envField.string({
        context: 'client',
        access: 'public',
        url: true,
        default: 'http://localhost:5173',
      }),
      PUBLIC_SITE_URL: envField.string({ context: 'client', access: 'public', url: true, default: DEFAULT_SITE_URL }),
      PUBLIC_POSTHOG_KEY: envField.string({ context: 'client', access: 'public', default: '<SEM_TOKEN>' }),
      PUBLIC_POSTHOG_HOST: envField.string({
        context: 'client',
        access: 'public',
        url: true,
        default: 'https://us.i.posthog.com',
      }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
