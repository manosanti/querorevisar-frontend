// PostHog (F12.2): only after consent and only when a key is configured. No PII: never e-mail, name or plate.
import { env } from '../env.ts';

export type AnalyticsEvent =
  | 'onboarding_started'
  | 'vehicle_created'
  | 'record_created'
  | 'km_updated'
  | 'pwa_installed'
  | 'push_enabled'
  | 'paywall_viewed'
  | 'premium_checkout_started'
  | 'premium_activated'
  | 'credits_purchase_started'
  | 'credits_purchased'
  | 'lookup_run'
  | 'lookup_reopened';

type Props = Record<string, string | number | boolean | null>;
type PostHogLike = { capture: (e: string, p?: Props) => void; identify: (id: string) => void; reset: () => void };

let client: PostHogLike | null = null;
let starting: Promise<void> | null = null;

export function startAnalytics(userId: string | null): Promise<void> {
  if (!env.posthogKey || client) return Promise.resolve();
  starting ??= import('./posthog-sdk.ts').then(({ default: posthog }) => {
    posthog.init(env.posthogKey!, {
      api_host: env.posthogHost,
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      persistence: 'localStorage',
      mask_all_text: true,
      mask_all_element_attributes: true,
    });
    client = posthog as unknown as PostHogLike;
    if (userId) client.identify(userId);
  });
  return starting;
}

export function stopAnalytics(): void {
  client?.reset();
  client = null;
  starting = null;
}

export function identify(userId: string): void {
  client?.identify(userId);
}

export function track(event: AnalyticsEvent, props: Props = {}): void {
  client?.capture(event, props);
}
