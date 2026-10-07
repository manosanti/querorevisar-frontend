// Painel (docs/screens.md#painel). Mobile/tablet: one column ordered band+card → counters → nudge →
// attention → lookup card → "Sem registro". Desktop: band+card full width, then two columns (1fr 1.15fr).
import { fipeDeltaText, fipeTrend, fipeUpdatedText, fmtInt, moneyShort } from '@qr/core';
import { api } from '@qr/api-client';
import {
  Avatar,
  Button,
  Chip,
  GarageSwitcher,
  PlusIcon,
  ProgressBar,
  SectionTitle,
  StatTile,
  StatusBadge,
  VehicleCard,
  cn,
} from '@qr/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import { useAvatarLetter } from '../../components/AppShell.tsx';
import { useBreakpoint } from '../../components/use-breakpoint.ts';
import { qk } from '../../lib/data/query.ts';
import { refreshState } from '../../lib/data/sync.ts';
import { useAppModel } from '../../lib/model.ts';
import { addVehicleOrPaywall } from '../../lib/navigation.ts';
import { openSheet, useUi } from '../../lib/ui-store.ts';
import { useCountUp, usePullToRefresh } from './use-painel-effects.ts';

function PullSpinner({ pull, busy }: { pull: number; busy: boolean }) {
  const p = Math.min(1, pull / 64);
  const C = 2 * Math.PI * 10;
  return (
    <div
      className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-on-dark-faint"
      style={{
        opacity: busy ? 1 : 0.35 + p * 0.65,
        transform: busy ? 'none' : `scale(${0.6 + p * 0.4}) rotate(${Math.round(pull * 4)}deg)`,
        transition: 'opacity .15s',
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" className={busy ? 'qr-spin' : undefined} aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="none" stroke="var(--on-dark-soft)" strokeWidth="2.5" />
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke="var(--white)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={busy ? C * 0.72 : C * (1 - p * 0.8)}
          transform="rotate(-90 12 12)"
        />
      </svg>
    </div>
  );
}

export function Painel() {
  const m = useAppModel();
  const navigate = useNavigate();
  const bp = useBreakpoint();
  const narrow = bp === 'mobile';
  const setActive = useUi(s => s.setActiveVehicle);
  const sheetOpen = useUi(s => !!s.sheet);
  const letter = useAvatarLetter();
  const [replay, setReplay] = useState(0);
  const flags = m.me?.flags;
  const vehicle = m.vehicle!;

  const onRefresh = useCallback(async () => {
    await refreshState();
    setReplay(r => r + 1);
  }, []);
  const { pull, dragging, busy } = usePullToRefresh(narrow && !sheetOpen, onRefresh);
  const kmShown = useCountUp(m.estKm, replay);

  const hasFipeCodes = !!(vehicle.fipeBrandCode && vehicle.fipeModelCode && vehicle.fipeYearCode);
  const showFipe = (flags?.fipeCard ?? true) && hasFipeCodes;
  const fipeQuery = useQuery({
    queryKey: qk.fipe(vehicle.id),
    queryFn: () => api.getVehicleFipe(vehicle.id),
    enabled: showFipe,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 2,
  });
  const fipe = fipeQuery.data
    ? {
        when: fipeUpdatedText(fipeQuery.data.updatedAt),
        value: moneyShort(fipeQuery.data.valueCents),
        delta: fipeDeltaText(fipeQuery.data.deltaPct30d),
        trend: fipeTrend(fipeQuery.data.deltaPct30d),
      }
    : null;

  const goItens = (filter: 'atencao' | 'ok') => {
    useUi.setState({ itensFilter: filter, itensQuery: '', openCats: {} });
    void navigate({ to: '/itens' });
  };

  const col = 'contents min-w-0 desktop:flex desktop:flex-col desktop:gap-[18px]';

  return (
    <>
      <div
        className={cn(
          'flex flex-1 flex-col gap-[18px] px-[22px] pb-6 tablet:px-7 tablet:pt-6 tablet:pb-8',
          'desktop:grid desktop:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] desktop:items-start desktop:gap-x-8 desktop:gap-y-[18px] desktop:px-9 desktop:pt-7 desktop:pb-10',
        )}
      >
        <div className={cn(col, 'desktop:col-span-full')}>
          <div className="order-1 -mx-[22px] flex flex-col gap-[18px] rounded-bl-[40px] bg-band px-[22px] pt-1 pb-[84px] tablet:mx-0 tablet:rounded-[24px_24px_24px_40px] tablet:pt-5">
            <div
              aria-hidden={!(pull > 0)}
              className="-mb-[18px] flex items-end justify-center overflow-hidden"
              style={{ height: pull, transition: dragging ? 'none' : 'height .32s cubic-bezier(.2,.8,.2,1)' }}
            >
              <div className="flex h-14 flex-none items-center justify-center">
                <PullSpinner pull={pull} busy={busy} />
              </div>
            </div>
            <div className="h-0" />
            {narrow ? (
              <div className="flex items-center justify-between">
                <img src="/brand/logo-header-petroleo.webp" alt="QueroRevisar" className="block h-[30px] w-auto" />
                <Avatar letter={letter} onClick={() => void navigate({ to: '/conta' })} label="Conta" />
              </div>
            ) : null}
            <GarageSwitcher
              vehicles={m.vehicles.map(v => ({ id: v.id, name: v.model, type: v.type, active: v.id === vehicle.id }))}
              onPick={setActive}
              onAdd={() => addVehicleOrPaywall(m, navigate)}
            />
          </div>
          <div className="order-1">
            <VehicleCard
              model={vehicle.model}
              brand={vehicle.brand}
              year={vehicle.year}
              type={vehicle.type}
              kmLabel={m.kmLabel}
              km={fmtInt(kmShown)}
              fipe={fipe}
              fipeUnavailable={fipeQuery.isError}
              showFipe={showFipe}
              onManage={() => openSheet({ type: 'vehicle' })}
              onUpdateKm={() => openSheet({ type: 'km' })}
            />
          </div>
        </div>

        <div className={col}>
          <div className="order-2 flex gap-2">
            <StatTile tone="over" value={m.counts.over} label="vencido" onClick={() => goItens('atencao')} />
            <StatTile tone="warn" value={m.counts.warn} label="em atenção" onClick={() => goItens('atencao')} />
            <StatTile tone="ok" value={m.counts.ok} label="em dia" onClick={() => goItens('ok')} />
          </div>

          {m.isAnonymous && m.vehicleRecords.length > 0 ? (
            <div className="order-3 flex items-center gap-3 rounded-16 border border-border px-4 py-[14px]">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">Salve seus registros</div>
                <div className="text-[13.5px] text-muted">
                  Crie uma conta para não perder o histórico e receber os alertas.
                </div>
              </div>
              <Button size="sm" onClick={() => void navigate({ to: '/entrar', search: { mode: 'signup' } })}>
                Criar conta
              </Button>
            </div>
          ) : null}

          {(flags?.vehicleLookups ?? true) ? (
            <div className="order-5 flex flex-col gap-3 rounded-20 bg-primary-tint p-[18px]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[18px] font-bold tracking-[-0.02em] text-primary-strong">
                    Consultar uma placa
                  </div>
                  <div className="mt-1 text-[14px] text-pretty text-primary-strong">
                    Dados, restrições, leilão e débitos de qualquer veículo. Útil antes de comprar um usado.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openSheet({ type: 'credits' })}
                  className="flex-none rounded-20 border-0 bg-white px-[11px] py-[5px] text-[12.5px] font-bold whitespace-nowrap text-primary tabular-nums"
                >
                  {m.creditsLabel}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="md"
                  className="h-11! min-w-[140px] flex-[1_1_auto] rounded-8! px-4! text-[15px]!"
                  onClick={() => void navigate({ to: '/consultas', search: { modo: 'outro' } })}
                >
                  Consultar placa
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  className="h-11! min-w-[140px] flex-[1_1_auto] rounded-8! px-4! text-[15px]!"
                  onClick={() => void navigate({ to: '/consultas', search: { modo: 'meu' } })}
                >
                  Conferir o meu {vehicle.model}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className={col}>
          <section className="order-4 min-w-0" aria-labelledby="attention-title">
            <SectionTitle id="attention-title" className="mb-1">
              Precisa de atenção
            </SectionTitle>
            {m.attention.length ? (
              <div className="flex flex-col">
                {m.attention.map(r => (
                  <button
                    key={r.item.id}
                    type="button"
                    onClick={() => void navigate({ to: '/itens/$itemId', params: { itemId: r.item.id } })}
                    className="flex w-full flex-col gap-2 border-0 border-b border-border bg-transparent py-[14px] text-left transition-transform active:scale-96"
                  >
                    <div className="flex w-full items-center gap-[14px]">
                      <div className="min-w-0 flex-1">
                        <div className="text-[16px] font-semibold">{r.item.name}</div>
                        <div className="mt-0.5 text-[13.5px] text-muted">{r.line}</div>
                      </div>
                      <StatusBadge status={r.status.key}>{r.badge}</StatusBadge>
                    </div>
                    <ProgressBar status={r.status.key} percent={r.barPct} label={r.item.name} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-[18px] text-[14.5px] text-muted">
                Nada vencendo. Registre as trocas que você já fez para o app acompanhar.
              </div>
            )}
          </section>

          {m.unregisteredKey.length ? (
            <section className="order-6" aria-labelledby="unregistered-title">
              <SectionTitle id="unregistered-title">Sem registro</SectionTitle>
              <div className="mt-0.5 mb-2.5 text-[13.5px] text-muted">
                Itens principais que o app ainda não acompanha.
              </div>
              <div className="flex flex-wrap gap-2">
                {m.unregisteredKey.map(r => (
                  <Chip key={r.item.id} onClick={() => openSheet({ type: 'register', itemId: r.item.id })}>
                    + {r.item.name}
                  </Chip>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {narrow ? (
        <div className="sticky bottom-[74px] z-[5] bg-linear-to-b from-white/0 to-white to-30% px-[22px] pb-3">
          <Button block icon={<PlusIcon />} onClick={() => openSheet({ type: 'register' })}>
            Registrar troca
          </Button>
        </div>
      ) : null}
    </>
  );
}
