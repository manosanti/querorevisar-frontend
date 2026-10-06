import { api } from '@qr/api-client';
import { toast } from '@qr/ui';
import { track } from './analytics.ts';

/** "Assinar Premium": creates the Mercado Pago subscription and leaves for its checkout (mock: /mock/checkout). */
export async function goToPremiumCheckout(): Promise<void> {
  try {
    track('premium_checkout_started');
    sessionStorage.setItem('qr-pending-payment', JSON.stringify({ kind: 'premium' }));
    const { initPoint } = await api.startPremiumCheckout();
    window.location.assign(initPoint);
  } catch {
    toast('Não foi possível abrir o pagamento. Tente de novo.', 'err');
  }
}
