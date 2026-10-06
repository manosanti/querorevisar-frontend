// Consultar placa (docs/screens.md#consultas): plate, product, previous lookups and the sticky CTA.
import { api, ApiError, NetworkError, type LookupProduct as ApiProduct } from '@qr/api-client';
import {
  credTxt,
  isValidPlate,
  LOOKUP_PRODUCTS,
  lookupPriceCents,
  lookupProduct,
  money,
  PLATE_ERROR,
  type LookupProductId,
} from '@qr/core';
import { BackButton, Button, Icon, ICON_PATHS, PlateInput, PlateTag, RadioCard, Segmented, Tag, toast } from '@qr/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { track } from '../../lib/analytics.ts';
import { qk } from '../../lib/data/query.ts';
import { refreshState } from '../../lib/data/sync.ts';
import { useAppModel } from '../../lib/model.ts';
import { openSheet } from '../../lib/ui-store.ts';

type Mode = 'other' | 'mine';

const fallbackProducts: ApiProduct[] = LOOKUP_PRODUCTS.map(p => ({
  id: p.id,
  name: p.name,
  desc: p.desc,
  credits: p.credits,
  priceCents: lookupPriceCents(p),
  tag: p.tag ?? null,
  parts: p.parts,
}));

export function ConsultaForm({ initialMode, onClose }: { initialMode: Mode; onClose: () => void }) {
  const m = useAppModel();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const vehicle = m.vehicle!;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [plate, setPlate] = useState(initialMode === 'mine' ? (vehicle.plate ?? '') : '');
  const [product, setProduct] = useState<LookupProductId>(initialMode === 'mine' ? 'debitos' : 'laudo');
  const [busy, setBusy] = useState(false);

  const { data: products = fallbackProducts } = useQuery({
    queryKey: qk.lookupProducts(),
    queryFn: () => api.listLookupProducts(),
    staleTime: 60 * 60 * 1000,
    placeholderData: fallbackProducts,
  });
  const selected = products.find(p => p.id === product) ?? products[0]!;
  const need = Math.max(0, selected.credits - m.credits);
  const history = m.lookups;

  const switchMode = (next: Mode) => {
    setMode(next);
    setPlate(next === 'mine' ? (vehicle.plate ?? '') : '');
  };

  const run = async () => {
    if (busy) return;
    if (!isValidPlate(plate)) {
      toast(PLATE_ERROR, 'err');
      return;
    }
    if (need) {
      openSheet({ type: 'credits', need });
      return;
    }
    setBusy(true);
    try {
      const result = await api.createLookup({
        plate,
        product,
        mine: mode === 'mine',
        vehicleId: mode === 'mine' ? vehicle.id : null,
      });
      qc.setQueryData(qk.lookup(result.id), result);
      track('lookup_run', { product, mine: mode === 'mine' });
      void refreshState();
      void navigate({ to: '/consultas/$id', params: { id: result.id }, replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.problem.code === 'insufficient-credits') {
        openSheet({ type: 'credits', need: err.problem.missing ?? need });
      } else if (err instanceof ApiError) {
        toast(err.problem.title, 'err');
      } else if (err instanceof NetworkError) {
        toast('Sem conexão. A consulta precisa de internet.', 'err');
      } else {
        toast('Não foi possível consultar agora. Tente de novo.', 'err');
      }
    } finally {
      setBusy(false);
    }
  };

  const cta = busy
    ? 'Consultando…'
    : !selected.credits
      ? 'Consultar grátis'
      : need
        ? 'Comprar créditos para consultar'
        : `Consultar · ${credTxt(selected.credits)}`;
  const balance = !selected.credits
    ? 'Não gasta crédito.'
    : need
      ? `Você tem ${credTxt(m.credits)}. Faltam ${need}.`
      : `Você tem ${credTxt(m.credits)}. Depois da consulta: ${m.credits - selected.credits}.`;

  return (
    <>
      <div className="flex flex-1 flex-col gap-5 px-[22px] pt-[18px]">
        <div className="flex items-center justify-between">
          <BackButton onClick={onClose} />
          <button
            type="button"
            onClick={() => openSheet({ type: 'credits' })}
            className="flex h-9 items-center gap-1.5 rounded-[18px] border border-border bg-white px-3 text-[14px] font-semibold tabular-nums transition-transform active:scale-96"
          >
            {m.creditsLabel}
            <span className="text-[17px] leading-none text-primary" aria-label="Comprar créditos">
              +
            </span>
          </button>
        </div>
        <div>
          <h1 className="m-0 text-[28px] leading-[1.15] font-bold tracking-[-0.02em]">Consultar placa</h1>
          <div className="mt-1 text-[15px] text-pretty text-muted">
            Digite a placa de qualquer veículo, o seu ou de outra pessoa.
          </div>
        </div>

        <Segmented
          label="De quem é o veículo"
          options={[
            { value: 'other', label: 'Outro veículo' },
            { value: 'mine', label: `Meu ${vehicle.model}` },
          ]}
          value={mode}
          onChange={switchMode}
        />

        <label className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-semibold">Placa</span>
          <PlateInput value={plate} onChange={setPlate} />
        </label>

        <div>
          <h2 className="m-0 mb-2.5 text-[18px] font-semibold tracking-[-0.02em]">O que consultar</h2>
          <div role="radiogroup" aria-label="O que consultar" className="flex flex-col gap-2">
            {products.map(p => (
              <RadioCard
                key={p.id}
                selected={p.id === product}
                align="start"
                onClick={() => setProduct(p.id)}
                aside={
                  <>
                    <span className="block text-[15px] font-bold whitespace-nowrap tabular-nums">
                      {p.credits ? money(p.priceCents) : 'Grátis'}
                    </span>
                    <span className="block text-[12.5px] whitespace-nowrap text-muted">
                      {p.credits ? `${credTxt(p.credits)}${p.id === 'laudo' ? ' · economiza 2' : ''}` : ''}
                    </span>
                  </>
                }
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[15.5px] font-semibold">{p.name}</span>
                  {p.tag ? <Tag>{p.tag}</Tag> : null}
                </span>
                <span className="mt-0.5 block text-[13.5px] text-pretty text-muted">{p.desc}</span>
              </RadioCard>
            ))}
          </div>
        </div>

        {m.plan === 'free' ? (
          <div className="flex items-center gap-3 rounded-14 bg-surface-2 px-[14px] py-3">
            <div className="flex-1 text-[14px] text-pretty text-ink-2">
              No Premium você ganha 2 créditos de consulta todo mês.
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                void navigate({ to: '/conta' });
              }}
              className="border-0 bg-transparent py-1.5 text-[14px] font-semibold whitespace-nowrap text-primary underline"
            >
              Ver Premium
            </button>
          </div>
        ) : null}

        {history.length ? (
          <div>
            <h2 className="m-0 text-[18px] font-semibold tracking-[-0.02em]">Consultas anteriores</h2>
            <div className="mt-0.5 mb-1.5 text-[13.5px] text-muted">Abrir de novo não gasta crédito.</div>
            {history.slice(0, 8).map(h => (
              <button
                key={h.id}
                type="button"
                onClick={() => {
                  track('lookup_reopened', { product: h.product });
                  void navigate({ to: '/consultas/$id', params: { id: h.id } });
                }}
                className="flex w-full items-center gap-3 border-0 border-b border-border bg-transparent py-3 text-left transition-transform active:scale-98"
              >
                <PlateTag plate={h.plate} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">
                    {h.model} {h.year}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {lookupProduct(h.product).name} · {new Date(h.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </span>
                <Icon paths={ICON_PATHS.chevronRight} size={16} strokeWidth={2.2} className="text-subtle" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="sticky bottom-0 flex flex-none flex-col gap-2 bg-linear-to-b from-white/0 to-white to-25% px-[22px] pt-4 pb-[26px]">
        <Button size="xl" block loading={busy} onClick={() => void run()}>
          {cta}
        </Button>
        <div className="text-center text-[13px] text-muted">{balance}</div>
      </div>
    </>
  );
}
