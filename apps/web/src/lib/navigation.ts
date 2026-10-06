import type { useNavigate } from '@tanstack/react-router';
import { track } from './analytics.ts';
import type { AppModel } from './model.ts';
import { openSheet } from './ui-store.ts';

type Navigate = ReturnType<typeof useNavigate>;

/** Free plan: 1 active vehicle. A second one opens the "Mais de um veículo" paywall. */
export function addVehicleOrPaywall(m: Pick<AppModel, 'plan' | 'vehicles'>, navigate: Navigate): void {
  if (m.plan === 'free' && m.vehicles.length >= 1) {
    track('paywall_viewed', { reason: 'veiculo' });
    openSheet({ type: 'paywall', reason: 'veiculo' });
    return;
  }
  void navigate({ to: '/onboarding', search: { modo: 'adicionar' } });
}

/** Back from an overlay: browser back when we came from inside the app, otherwise the fallback route. */
export function goBack(navigate: Navigate, fallback: string): void {
  const idx = (window.history.state as { idx?: number; __TSR_index?: number } | null)?.__TSR_index ?? 0;
  if (idx > 0) window.history.back();
  else void navigate({ to: fallback });
}
