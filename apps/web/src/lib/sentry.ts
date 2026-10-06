// Sentry (F12.1) only when VITE_SENTRY_DSN is configured. No PII is sent.
import { env } from '../env.ts';

export async function startSentry(): Promise<void> {
  if (!env.sentryDsn) return;
  const Sentry = await import('./sentry-sdk.ts');
  Sentry.init({
    dsn: env.sentryDsn,
    release: env.release,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.user) event.user = event.user.id === undefined ? {} : { id: event.user.id };
      return event;
    },
  });
}
