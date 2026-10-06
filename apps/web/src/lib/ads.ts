// Native ads only on the free plan and only where docs/domain.md#anúncios allows (never Painel/alerts).
import { env } from '../env.ts';
import { track } from './analytics.ts';
import { useAppModel } from './model.ts';
import { openSheet } from './ui-store.ts';

export function useAds(): { show: boolean; onRemove: () => void } {
  const m = useAppModel();
  const show = env.adsMode !== 'off' && m.plan === 'free' && (m.me?.flags.ads ?? true);
  return {
    show,
    onRemove: () => {
      track('paywall_viewed', { reason: 'ads' });
      openSheet({ type: 'paywall', reason: 'ads' });
    },
  };
}
