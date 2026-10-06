// PostHog with consent (F12.2): nothing is loaded before "Aceitar"; posthog-js is fetched on demand.
// Only page views are captured (no autocapture, no session recording) and the landing never puts PII in URLs.
import type { PostHog } from 'posthog-js';
import { POSTHOG_HOST, POSTHOG_KEY } from '../config';
import { type Consent, isAnalyticsConfigured, readConsent, writeConsent } from '../lib/consent';

let client: PostHog | null = null;
let loading: Promise<void> | null = null;

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function start(): Promise<void> {
  loading ??= import('posthog-js').then(({ default: posthog }) => {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      autocapture: false,
      capture_pageview: true,
      capture_pageleave: true,
      disable_session_recording: true,
      disable_surveys: true,
      mask_all_text: true,
      mask_all_element_attributes: true,
      person_profiles: 'identified_only',
      persistence: 'localStorage+cookie',
    });
    if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing();
    client = posthog;
  });
  return loading;
}

function stop(): void {
  client?.opt_out_capturing();
}

function apply(consent: Consent): void {
  writeConsent(storage(), consent);
  if (consent === 'granted') void start();
  else stop();
  document.dispatchEvent(new CustomEvent('qr:consent', { detail: consent }));
}

function banner(): HTMLElement | null {
  return document.getElementById('consent-banner');
}

/** Opens the banner again (used by the "Privacidade" page controls). */
export function reopenConsent(): void {
  const el = banner();
  if (!el) return;
  el.hidden = false;
  el.querySelector<HTMLButtonElement>('[data-consent="granted"]')?.focus();
}

export function currentConsent(): Consent | null {
  return readConsent(storage());
}

export function initAnalytics(): void {
  if (!isAnalyticsConfigured(POSTHOG_KEY)) return;
  const el = banner();
  el?.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-consent]');
    const choice = button?.dataset.consent;
    if (choice !== 'granted' && choice !== 'denied') return;
    apply(choice);
    el.hidden = true;
  });
  const stored = currentConsent();
  if (stored === 'granted') void start();
  else if (stored === null && el) el.hidden = false;
}
