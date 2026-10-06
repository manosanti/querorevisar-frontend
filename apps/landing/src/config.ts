// Build-time configuration of the landing. Env vars come from apps/landing/.env (copy of env/landing.env.example)
// or from the CI environment; the schema and defaults are in astro.config.ts.
import { PUBLIC_APP_URL, PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_KEY } from 'astro:env/client';

export const APP_URL = PUBLIC_APP_URL;
export const POSTHOG_KEY = PUBLIC_POSTHOG_KEY;
export const POSTHOG_HOST = PUBLIC_POSTHOG_HOST;

/**
 * Feature switches for prototype elements that depend on owner decisions (PENDENCIAS.md).
 * - appleLogin: mirrors the app flag `apple_login` (off, decision D07). The prototype shows an Apple button.
 * - annualBilling: the prototype's Mensal/Anual toggle; only the monthly plan exists in docs/domain.md.
 */
export const FEATURES = {
  appleLogin: false,
  annualBilling: true,
} as const;
