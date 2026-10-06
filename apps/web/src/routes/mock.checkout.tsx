// PAYMENTS_MODE=mock: stands in for the Mercado Pago checkout page (docs/mercadopago.md#modo-mock).
import { api } from '@qr/api-client';
import { Button, Notice, toast } from '@qr/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/mock/checkout')({
  validateSearch: (s: Record<string, unknown>): { kind?: 'premium' | 'credits'; id?: string } => ({
    ...(s.kind === 'premium' || s.kind === 'credits' ? { kind: s.kind } : {}),
    ...(typeof s.id === 'string' ? { id: s.id } : {}),
  }),
  component: MockCheckout,
});

function MockCheckout() {
  const { kind, id } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const approve = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await api.approveMockPayment(id);
      void navigate({ to: '/conta', search: { pagamento: 'ok' }, replace: true });
    } catch {
      setBusy(false);
      toast('Não foi possível aprovar o pagamento de teste.', 'err');
    }
  };

  return (
    <div className="flex min-h-screen justify-center bg-page">
      <div className="flex w-full max-w-[480px] flex-col justify-center gap-5 bg-white px-8 py-10">
        <img src="/brand/icone.webp" alt="" className="h-16 w-16 self-center" />
        <h1 className="m-0 text-center text-[24px] font-bold tracking-[-0.02em]">Pagamento de teste</h1>
        <Notice tone="neutral">
          Ambiente de teste: nenhum valor é cobrado.{' '}
          {kind === 'premium' ? 'Confirme para ativar o Premium.' : 'Confirme para receber os créditos.'}
        </Notice>
        <Button block loading={busy} disabled={!id} onClick={() => void approve()}>
          Aprovar pagamento
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => void navigate({ to: '/conta', search: { pagamento: 'erro' } })}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
