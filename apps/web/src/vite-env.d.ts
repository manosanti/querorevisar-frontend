/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __CATALOG_VERSION__: number;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_ADS_MODE?: string;
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_ADSENSE_SLOT_ITENS?: string;
  readonly VITE_ADSENSE_SLOT_HISTORICO?: string;
  readonly VITE_ADSENSE_SLOT_CONTA?: string;
  readonly VITE_LANDING_URL?: string;
  readonly VITE_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.webp' {
  const src: string;
  export default src;
}
