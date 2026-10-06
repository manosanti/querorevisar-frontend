import { credTxt } from '@qr/core';
import { toast } from '@qr/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { TabRoute } from '../../components/TabRoute.tsx';
import { Conta } from '../../features/conta/Conta.tsx';
import { track } from '../../lib/analytics.ts';
import { qk, queryClient } from '../../lib/data/query.ts';
import { refreshState } from '../../lib/data/sync.ts';
import { useAuth } from '../../lib/auth/store.ts';
import type { LocalState } from '../../lib/data/state.ts';

type Payment = 'ok' | 'pendente' | 'erro';

export const Route = createFileRoute('/_app/conta')({
  validateSearch: (s: Record<string, unknown>): { pagamento?: Payment } =>
    s.pagamento === 'ok' || s.pagamento === 'pendente' || s.pagamento === 'erro' ? { pagamento: s.pagamento } : {},
  component: ContaRoute,
});

const plan = () => {
  const uid = useAuth.getState().session?.user.id;
  return uid ? queryClient.getQueryData<LocalState>(qk.sync(uid))?.me?.plan : undefined;
};

/** Return from Mercado Pago (MP_BACK_URL_*): refresh the state and confirm with the prototype texts. */
async function handlePaymentReturn(result: Payment) {
  const raw = sessionStorage.getItem('qr-pending-payment');
  sessionStorage.removeItem('qr-pending-payment');
  const pending = raw ? (JSON.parse(raw) as { kind: 'premium' | 'credits'; credits?: number }) : null;
  if (result === 'erro') return toast('Pagamento não aprovado. Tente de novo.', 'err');
  if (result === 'pendente') return toast('Pagamento em análise. Avisamos quando for aprovado.');
  for (let i = 0; i < 5; i++) {
    await refreshState();
    if (pending?.kind !== 'premium' || plan() === 'premium') break;
    await new Promise(r => setTimeout(r, 2000));
  }
  if (pending?.kind === 'premium') {
    if (plan() === 'premium') {
      track('premium_activated');
      toast('Premium ativado · +2 créditos de consulta');
    } else toast('Pagamento em análise. Avisamos quando for aprovado.');
  } else if (pending?.kind === 'credits' && pending.credits) {
    track('credits_purchased', { credits: pending.credits, method: 'card' });
    toast(`${credTxt(pending.credits)} adicionados`);
  }
}

function ContaRoute() {
  const { pagamento } = Route.useSearch();
  const navigate = useNavigate();
  useEffect(() => {
    if (!pagamento) return;
    void navigate({ to: '/conta', search: {}, replace: true });
    void handlePaymentReturn(pagamento);
  }, [pagamento, navigate]);
  return (
    <TabRoute tab="conta">
      <Conta />
    </TabRoute>
  );
}
