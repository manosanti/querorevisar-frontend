// Histórico (docs/screens.md#histórico): vehicle selector, search, filters, totals, list (mobile) or table (≥768).
import { dateBR, dateLongBR, DAY_MS, fmtInt, FREE_HISTORY_DAYS, money, normalizeText } from '@qr/core';
import type { MaintenanceRecord, Vehicle } from '@qr/api-client';
import {
  AdSlot,
  Button,
  EmptyState,
  FilterPill,
  Icon,
  ICON_PATHS,
  InfoTile,
  Input,
  Notice,
  PlusIcon,
  ScreenTitle,
  VehicleImage,
  cn,
} from '@qr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBreakpoint } from '../../components/use-breakpoint.ts';
import { env } from '../../env.ts';
import { useAds } from '../../lib/ads.ts';
import { useCatalog } from '../../lib/data/catalog.ts';
import { useAppModel } from '../../lib/model.ts';
import { addVehicleOrPaywall } from '../../lib/navigation.ts';
import { openSheet, useUi, type HistFilter } from '../../lib/ui-store.ts';

const FILTERS: Array<[HistFilter, string]> = [
  ['todos', 'Todas'],
  ['casa', 'Em casa'],
  ['mec', 'No mecânico'],
  ['custo', 'Com custo'],
];
const COLS =
  'grid-cols-[minmax(96px,.8fr)_minmax(0,1.6fr)_minmax(84px,.7fr)_minmax(0,1fr)_minmax(84px,.7fr)_minmax(84px,.7fr)]';
const typeLabel = (v: Vehicle) => (v.type === 'moto' ? 'Moto' : 'Carro');

interface Entry {
  record: MaintenanceRecord;
  vehicle: Vehicle;
  name: string;
  category: string;
}

function VehiclePicker({ all, onAll }: { all: boolean; onAll: (all: boolean) => void }) {
  const m = useAppModel();
  const navigate = useNavigate();
  const setActive = useUi(s => s.setActiveVehicle);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const vehicle = m.vehicle!;
  const many = m.vehicles.length > 1;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const option = (
    key: string,
    selected: boolean,
    onPick: () => void,
    lead: React.ReactNode,
    name: string,
    sub: string,
  ) => (
    <button
      key={key}
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={cn(
        'flex w-full items-center gap-3 rounded-10 border-0 p-2 text-left',
        selected ? 'bg-surface-1' : 'bg-transparent',
      )}
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center">{lead}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{name}</span>
        <span className="block text-[13px] text-muted">{sub}</span>
      </span>
      {selected ? <Icon paths={ICON_PATHS.check} strokeWidth={2.4} className="text-primary" /> : null}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-water=""
        className="flex w-full items-center gap-3 rounded-14 border border-border bg-white py-2 pr-[14px] pl-2 text-left"
      >
        <span className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-10 bg-surface-1">
          {all && many ? (
            <span className="flex">
              <VehicleImage type="car" size={28} className="-mr-2" />
              <VehicleImage type="moto" size={28} />
            </span>
          ) : (
            <VehicleImage type={vehicle.type} size={44} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] text-muted">Veículo</span>
          <span className="block text-[16px] font-semibold">
            {all && many ? 'Todos os veículos' : `${vehicle.brand} ${vehicle.model}`}
          </span>
        </span>
        <Icon
          paths={ICON_PATHS.chevronDown}
          className="transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open ? (
        <div className="absolute top-[calc(100%+6px)] right-0 left-0 z-5 rounded-14 border border-border bg-white p-1.5 shadow-dropdown">
          <div role="listbox" aria-label="Veículo">
            {many
              ? option(
                  'all',
                  all,
                  () => {
                    onAll(true);
                    setOpen(false);
                  },
                  <span className="text-[13px] font-bold text-primary">Todos</span>,
                  'Todos os veículos',
                  `${m.vehicles.length} veículos`,
                )
              : null}
            {m.vehicles.map(v =>
              option(
                v.id,
                !(all && many) && v.id === vehicle.id,
                () => {
                  onAll(false);
                  setActive(v.id);
                  setOpen(false);
                },
                <VehicleImage type={v.type} size={40} />,
                `${v.brand} ${v.model}`,
                `${v.year} · ${typeLabel(v)}`,
              ),
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              addVehicleOrPaywall(m, navigate);
            }}
            className="mt-1 flex w-full items-center gap-3 border-0 border-t border-border bg-transparent px-2 py-2.5 text-left text-[15px] font-semibold text-primary"
          >
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary text-white">
              <PlusIcon />
            </span>
            Adicionar veículo
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Historico() {
  const m = useAppModel();
  const navigate = useNavigate();
  const wide = useBreakpoint() !== 'mobile';
  const { histVehicle, histFilter: filter, histQuery: query, set, setActiveVehicle } = useUi();
  const { data: catalogFile } = useCatalog();
  const ads = useAds();
  const vehicle = m.vehicle!;
  const all = histVehicle === 'all' && m.vehicles.length > 1;

  const names = useMemo(() => {
    const map = new Map<string, { name: string; category: string }>();
    for (const c of catalogFile?.catalog.categories ?? [])
      for (const it of c.items) map.set(it.id, { name: it.name, category: c.name });
    return map;
  }, [catalogFile]);

  const { visible, total, hiddenByPlan } = useMemo(() => {
    const sources = all ? m.vehicles : [vehicle];
    const byId = new Map(sources.map(v => [v.id, v] as const));
    let pool: Entry[] = m.records
      .filter(r => byId.has(r.vehicleId))
      .map(r => {
        const n = names.get(r.itemId);
        return { record: r, vehicle: byId.get(r.vehicleId)!, name: n?.name ?? 'Item', category: n?.category ?? '' };
      });
    const total = pool.length;
    if (m.plan === 'free') {
      const cutoff = Date.now() - FREE_HISTORY_DAYS * DAY_MS;
      pool = pool.filter(p => !p.record.date || new Date(`${p.record.date}T12:00`).getTime() >= cutoff);
    }
    const hiddenByPlan = pool.length < total;
    const q = normalizeText(query);
    const visible = pool
      .filter(
        p =>
          (!q || normalizeText(`${p.name} ${p.record.brand ?? ''} ${p.category}`).includes(q)) &&
          (filter === 'todos' ||
            (filter === 'casa' && p.record.where !== 'shop') ||
            (filter === 'mec' && p.record.where === 'shop') ||
            (filter === 'custo' && !!p.record.costCents)),
      )
      .sort((a, b) => (b.record.date ?? '').localeCompare(a.record.date ?? '') || b.record.km - a.record.km);
    return { visible, total, hiddenByPlan };
  }, [all, m.vehicles, m.records, m.plan, vehicle, names, query, filter]);

  const open = (e: Entry) => {
    if (e.vehicle.id !== vehicle.id) setActiveVehicle(e.vehicle.id);
    void navigate({ to: '/itens/$itemId', params: { itemId: e.record.itemId } });
  };
  const spent = visible.reduce((sum, e) => sum + (e.record.costCents ?? 0), 0);

  return (
    <div className="flex flex-1 flex-col gap-[14px] px-[22px] pt-[22px] pb-6">
      <div className="flex items-center justify-between gap-3">
        <ScreenTitle>Histórico</ScreenTitle>
        <Button size="pill" icon={<PlusIcon />} onClick={() => openSheet({ type: 'register' })}>
          Registrar troca
        </Button>
      </div>

      <VehiclePicker all={all} onAll={v => set({ histVehicle: v ? 'all' : 'active' })} />

      <Input
        aria-label="Buscar troca, peça ou marca"
        placeholder="Buscar troca, peça ou marca"
        value={query}
        onChange={e => set({ histQuery: e.target.value })}
      />
      <div className="flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Filtros">
        {FILTERS.map(([key, label]) => (
          <FilterPill key={key} active={filter === key} onClick={() => set({ histFilter: key })}>
            {label}
          </FilterPill>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <InfoTile label="Trocas registradas" value={visible.length} />
        <InfoTile label="Gasto informado" value={money(spent)} />
      </div>

      <div className="flex flex-col">
        {wide ? (
          <div
            className={cn(
              'grid gap-4 border-b border-border py-2 text-[12px] font-semibold tracking-[.04em] text-subtle uppercase',
              COLS,
            )}
          >
            <span>Data</span>
            <span>Item</span>
            <span>Onde</span>
            <span>Marca</span>
            <span className="text-right">Km</span>
            <span className="text-right">Custo</span>
          </div>
        ) : null}
        {visible.map((e, i) => (
          <div key={e.record.id}>
            {wide ? (
              <button
                type="button"
                onClick={() => open(e)}
                className={cn(
                  'grid w-full items-center gap-4 border-0 border-b border-border bg-transparent py-[13px] text-left text-[14.5px]',
                  COLS,
                )}
              >
                <span className="text-muted tabular-nums">{e.record.date ? dateBR(e.record.date) : '—'}</span>
                <span className="min-w-0 font-semibold">
                  {e.name}
                  {all ? <span className="block text-[12.5px] font-medium text-muted">{e.vehicle.model}</span> : null}
                </span>
                <span>{e.record.where === 'shop' ? 'Mecânico' : 'Em casa'}</span>
                <span className="min-w-0 text-ink-2">{e.record.brand || '—'}</span>
                <span className="text-right font-semibold tabular-nums">{fmtInt(e.record.km)} km</span>
                <span className="text-right tabular-nums">{e.record.costCents ? money(e.record.costCents) : '—'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => open(e)}
                className="flex w-full items-center gap-3 border-0 border-b border-border bg-transparent py-[14px] text-left transition-transform active:scale-96"
              >
                {all ? <VehicleImage type={e.vehicle.type} size={40} alt={e.vehicle.model} /> : null}
                <div className="min-w-0 flex-1">
                  <div className="text-[15.5px] font-semibold">{e.name}</div>
                  <div className="text-[13px] text-muted">
                    {[
                      e.record.date ? dateLongBR(e.record.date) : 'Data não informada',
                      e.record.where === 'shop' ? 'No mecânico' : 'Em casa',
                      e.record.brand,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[15px] font-semibold tabular-nums">{fmtInt(e.record.km)} km</div>
                  <div className="text-[13px] text-muted">{e.record.costCents ? money(e.record.costCents) : ''}</div>
                </div>
              </button>
            )}
            {i === 1 && ads.show ? (
              <div className="my-2.5 flex items-center gap-3 rounded-16 border border-border p-[14px]">
                <div className="h-[52px] w-[52px] flex-none rounded-12 bg-surface-2" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-semibold tracking-[.04em] text-subtle uppercase">Patrocinado</div>
                  <div className="text-[15px] font-semibold">Óleo 5W30 sintético 1 L</div>
                  <div className="text-[13px] text-muted">Compatível com {vehicle.model} · Loja parceira</div>
                </div>
                <div className="text-[15px] font-bold whitespace-nowrap tabular-nums">R$ 42,90</div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {ads.show && visible.length > 0 ? (
        <AdSlot
          slot="historico-rodape"
          size="in-feed"
          mode={env.adsMode}
          adsenseClient={env.adsenseClient ?? undefined}
          adsenseSlot={env.adsenseSlots.historico ?? undefined}
          onRemoveAds={ads.onRemove}
        />
      ) : null}
      {m.plan === 'free' && hiddenByPlan ? (
        <Notice className="rounded-16 px-4 py-[14px]">
          O plano grátis mostra os últimos 12 meses. O histórico completo está no Premium.
        </Notice>
      ) : null}
      {visible.length === 0 ? (
        <EmptyState>
          {total ? 'Nenhuma troca encontrada com esses filtros.' : 'Nenhuma troca registrada ainda.'}
        </EmptyState>
      ) : null}
    </div>
  );
}
