// "Comprar créditos": packs, Pix | Cartão, then the Pix QR with copy-and-paste, expiry countdown and
// polling every 3 s (max 10 min) until approved (docs/mercadopago.md, PLAN F09.3).
import { api, ApiError, type CreditPack as ApiPack, type CreditPurchase } from '@qr/api-client';
import { CREDIT_PACKS, credTxt, DEFAULT_PACK_INDEX, discountPct, money, packIndexFor, unitPriceCents } from '@qr/core';
import { Button, RadioCard, Tag, toast, cn } from '@qr/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { track } from '../../lib/analytics.ts';
import { qk } from '../../lib/data/query.ts';
import { refreshState } from '../../lib/data/sync.ts';
import { closeSheet } from '../../lib/ui-store.ts';

const fallbackPacks: ApiPack[] = CREDIT_PACKS.map(p => ({
  id: p.id,
  credits: p.credits,
  priceCents: p.priceCents,
  unitPriceCents: unitPriceCents(p),
  discountPct: discountPct(p),
  tag: p.tag ?? null,
}));

const POLL_MS = 3000;
const POLL_MAX_MS = 10 * 60 * 1000;

function PixView({ purchase, onBack }: { purchase: CreditPurchase; onBack: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState(purchase.status);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const started = Date.now();
    let stop = false;
    const poll = async () => {
      if (stop) return;
      try {
        const p = await api.getCreditPurchase(purchase.purchaseId);
        setStatus(p.status);
        if (p.status === 'approved') {
          track('credits_purchased', { credits: p.credits, method: 'pix' });
          await refreshState();
          closeSheet();
          toast(`${credTxt(p.credits)} adicionados`);
          return;
        }
        if (p.status !== 'pending') return;
      } catch {
        // keep polling: offline or a transient error
      }
      if (Date.now() - started < POLL_MAX_MS) setTimeout(() => void poll(), POLL_MS);
    };
    const first = setTimeout(() => void poll(), POLL_MS);
    return () => {
      stop = true;
      clearTimeout(first);
    };
  }, [purchase.purchaseId]);

  const left = purchase.expiresAt ? Math.max(0, Date.parse(purchase.expiresAt) - now) : null;
  const expired = status === 'expired' || left === 0;
  const mmss =
    left !== null
      ? `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`
      : '';

  const copy = async () => {
    if (!purchase.qrCode) return;
    try {
      await navigator.clipboard.writeText(purchase.qrCode);
      toast('Código Pix copiado');
    } catch {
      toast('Não foi possível copiar. Selecione o código e copie.', 'err');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="m-0 text-[22px] font-bold tracking-[-0.02em]">Pague com Pix</h2>
        <div className="mt-1 text-[14.5px] text-pretty text-muted">
          {money(purchase.amountCents)} · {credTxt(purchase.credits)}. Escaneie o código no app do banco ou use o Pix
          copia e cola.
        </div>
      </div>
      {expired ? (
        <div className="rounded-14 bg-over-bg px-[14px] py-3 text-[14px] text-over-fg">
          O código Pix expirou. Volte e gere outro.
        </div>
      ) : (
        <>
          {purchase.qrCodeBase64 ? (
            <img
              src={`data:image/png;base64,${purchase.qrCodeBase64}`}
              alt="QR code do Pix"
              className="mx-auto h-[220px] w-[220px] rounded-14 border border-border p-2"
            />
          ) : null}
          {purchase.qrCode ? (
            <div className="rounded-12 bg-surface-1 px-[14px] py-3 font-mono text-[12.5px] break-all text-ink-2 select-all">
              {purchase.qrCode}
            </div>
          ) : null}
          <Button block variant="outline" onClick={() => void copy()}>
            Copiar código Pix
          </Button>
          <div className="text-center text-[13px] text-muted tabular-nums" aria-live="polite">
            {status === 'pending' ? `Aguardando o pagamento · expira em ${mmss}` : null}
          </div>
        </>
      )}
      <Button variant="ghost" className="w-full" onClick={onBack}>
        Voltar
      </Button>
    </div>
  );
}

export function CreditsSheet({ need }: { need?: number | undefined }) {
  const [packIndex, setPackIndex] = useState(() => (need ? packIndexFor(need) : DEFAULT_PACK_INDEX));
  const [method, setMethod] = useState<'pix' | 'card'>('pix');
  const [busy, setBusy] = useState(false);
  const [pix, setPix] = useState<CreditPurchase | null>(null);

  const { data: packs = fallbackPacks } = useQuery({
    queryKey: qk.creditPacks(),
    queryFn: () => api.listCreditPacks(),
    staleTime: 60 * 60 * 1000,
    placeholderData: fallbackPacks,
  });
  const pack = packs[packIndex] ?? packs[DEFAULT_PACK_INDEX] ?? packs[0]!;

  if (pix) return <PixView purchase={pix} onBack={() => setPix(null)} />;

  const buy = async () => {
    setBusy(true);
    try {
      track('credits_purchase_started', { credits: pack.credits, method });
      const purchase = await api.createCreditPurchase({ packId: pack.id, method });
      if (method === 'card' && purchase.initPoint) {
        sessionStorage.setItem('qr-pending-payment', JSON.stringify({ kind: 'credits', credits: pack.credits }));
        window.location.assign(purchase.initPoint);
        return;
      }
      setPix(purchase);
    } catch (err) {
      toast(
        err instanceof ApiError ? err.problem.title : 'Não foi possível iniciar o pagamento. Tente de novo.',
        'err',
      );
    } finally {
      setBusy(false);
    }
  };

  const methodBtn = (value: 'pix' | 'card', label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={method === value}
      onClick={() => setMethod(value)}
      className={cn(
        'h-11 rounded-12 bg-white text-[14.5px] font-semibold',
        method === value ? 'border-2 border-primary' : 'border border-border',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="m-0 text-[22px] font-bold tracking-[-0.02em]">Comprar créditos</h2>
        <div className="mt-1 text-[14.5px] text-pretty text-muted">
          {need
            ? `Faltam ${credTxt(need)} para esta consulta. Pacotes saem mais barato que o avulso.`
            : 'Cada consulta custa de 1 a 6 créditos. Pacotes saem mais barato que o avulso.'}
        </div>
      </div>
      <div role="radiogroup" aria-label="Pacotes" className="flex flex-col gap-2">
        {packs.map((p, i) => (
          <RadioCard
            key={p.id}
            selected={i === packIndex}
            onClick={() => setPackIndex(i)}
            aside={
              <>
                <span className="block text-[16px] font-bold tabular-nums">{money(p.priceCents)}</span>
                {p.discountPct > 0 ? (
                  <span className="block text-[12.5px] font-semibold text-primary">Economia de {p.discountPct}%</span>
                ) : null}
              </>
            }
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[16px] font-semibold">{credTxt(p.credits)}</span>
              {p.tag ? <Tag>{p.tag}</Tag> : null}
            </span>
            <span className="mt-px block text-[13px] text-muted">{money(p.unitPriceCents)} por crédito</span>
          </RadioCard>
        ))}
      </div>
      <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-2 gap-2">
        {methodBtn('pix', 'Pix')}
        {methodBtn('card', 'Cartão')}
      </div>
      <Button size="xl" block loading={busy} onClick={() => void buy()}>
        Pagar {money(pack.priceCents)} {method === 'pix' ? 'com Pix' : 'no cartão'}
      </Button>
    </div>
  );
}
