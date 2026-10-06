// Browser configuration (only VITE_* variables reach the client; nothing here is secret).
// Any value equal to <SEM_TOKEN>/<PREENCHER> (or empty) switches the integration to its mock/off mode.

const raw = import.meta.env;

export const isPlaceholder = (v: string | undefined | null): boolean => !v || v.startsWith('<') || v === 'undefined';
const value = (v: string | undefined): string | null => (isPlaceholder(v) ? null : v!);

export type AdsMode = 'placeholder' | 'adsense' | 'off';

export const env = {
  apiUrl: value(raw.VITE_API_URL) ?? 'http://localhost:8080',
  supabaseUrl: value(raw.VITE_SUPABASE_URL),
  supabaseAnonKey: value(raw.VITE_SUPABASE_ANON_KEY),
  vapidPublicKey: value(raw.VITE_VAPID_PUBLIC_KEY),
  sentryDsn: value(raw.VITE_SENTRY_DSN),
  posthogKey: value(raw.VITE_POSTHOG_KEY),
  posthogHost: value(raw.VITE_POSTHOG_HOST) ?? 'https://us.i.posthog.com',
  adsMode: ((value(raw.VITE_ADS_MODE) as AdsMode | null) ?? 'placeholder') satisfies AdsMode,
  adsenseClient: value(raw.VITE_ADSENSE_CLIENT),
  adsenseSlots: {
    itens: value(raw.VITE_ADSENSE_SLOT_ITENS),
    historico: value(raw.VITE_ADSENSE_SLOT_HISTORICO),
    conta: value(raw.VITE_ADSENSE_SLOT_CONTA),
  },
  landingUrl: value(raw.VITE_LANDING_URL) ?? 'http://localhost:4321',
  release: value(raw.VITE_RELEASE) ?? 'dev',
  catalogVersion: __CATALOG_VERSION__,
} as const;

/**
 * Auth runs against Supabase when URL and anon key are configured; otherwise against the API's local
 * dev auth (`AUTH_MODE=dev`, local profile only).
 */
export const authMode: 'supabase' | 'dev' = env.supabaseUrl && env.supabaseAnonKey ? 'supabase' : 'dev';
