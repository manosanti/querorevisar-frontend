import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const dataDir = fileURLToPath(new URL('../../data/', import.meta.url));
const placeholder = (v: string | undefined) => !v || v.startsWith('<');

/**
 * Publishes data/catalog.json + data/planos.json as the static, versioned /catalog.v{N}.json
 * (F05.3: the API only reports N through GET /v1/catalog/version).
 */
function catalogFile(): Plugin {
  const read = () => {
    const catalog = JSON.parse(readFileSync(`${dataDir}catalog.json`, 'utf8')) as { version: number };
    const plans = JSON.parse(readFileSync(`${dataDir}planos.json`, 'utf8')) as { plans: unknown[] };
    return {
      version: catalog.version,
      body: JSON.stringify({ version: catalog.version, catalog, plans: plans.plans }),
    };
  };
  return {
    name: 'qr-catalog-file',
    config() {
      return { define: { __CATALOG_VERSION__: JSON.stringify(read().version) } };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const { version, body } = read();
        if (req.url?.split('?')[0] !== `/catalog.v${version}.json`) return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(body);
      });
    },
    generateBundle() {
      const { version, body } = read();
      this.emitFile({ type: 'asset', fileName: `catalog.v${version}.json`, source: body });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const sentryUpload = !placeholder(env.SENTRY_AUTH_TOKEN) && !placeholder(env.VITE_SENTRY_DSN);
  return {
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      catalogFile(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        manifest: {
          name: 'QueroRevisar',
          short_name: 'QueroRevisar',
          description: 'Controle de manutenção do seu carro ou moto.',
          lang: 'pt-BR',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          theme_color: '#125865',
          background_color: '#ffffff',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
          globIgnores: [
            'icons/icon-512.png',
            'icons/icon-maskable-512.png',
            'icons/apple-touch-icon.png',
            // Optional SDKs loaded on demand stay out of the precache.
            'assets/sentry-sdk-*.js',
            'assets/posthog-sdk-*.js',
          ],
        },
        devOptions: { enabled: false, type: 'module' },
      }),
      ...(sentryUpload
        ? [
            sentryVitePlugin({
              ...(env.SENTRY_AUTH_TOKEN ? { authToken: env.SENTRY_AUTH_TOKEN } : {}),
              ...(env.SENTRY_ORG ? { org: env.SENTRY_ORG } : {}),
              ...(env.SENTRY_PROJECT_WEB ? { project: env.SENTRY_PROJECT_WEB } : {}),
              ...(env.VITE_RELEASE ? { release: { name: env.VITE_RELEASE } } : {}),
            }),
          ]
        : []),
    ],
    build: {
      sourcemap: sentryUpload ? 'hidden' : false,
      target: 'es2022',
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 5173, strictPort: true },
  };
});
