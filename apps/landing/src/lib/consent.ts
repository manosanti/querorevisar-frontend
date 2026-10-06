// Analytics consent (F12.2): PostHog only starts after an explicit "Aceitar" and when a real key is set.

export const CONSENT_STORAGE_KEY = 'qr-analytics-consent';

export type Consent = 'granted' | 'denied';

export function parseConsent(value: string | null | undefined): Consent | null {
  return value === 'granted' || value === 'denied' ? value : null;
}

/** False for empty keys and for the `<SEM_TOKEN>` / `<PREENCHER>` placeholders of the .env.example files. */
export function isAnalyticsConfigured(key: string | null | undefined): boolean {
  const k = key?.trim() ?? '';
  return k !== '' && !/^<[^>]*>$/.test(k);
}

/** Reads the stored choice; storage can be blocked (private mode, cookies disabled), so failures mean "no choice". */
export function readConsent(storage: Pick<Storage, 'getItem'> | undefined): Consent | null {
  try {
    return parseConsent(storage?.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeConsent(storage: Pick<Storage, 'setItem'> | undefined, consent: Consent): void {
  try {
    storage?.setItem(CONSENT_STORAGE_KEY, consent);
  } catch {
    // Blocked storage: the choice lasts for this page view only.
  }
}
