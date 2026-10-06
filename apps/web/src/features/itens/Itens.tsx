// Itens (docs/screens.md#itens): search, filters and collapsible groups by category.
// Mobile: rows with name, status line and badge. ≥768: a table per group (Item | Situação | Progresso | Status).
import { normalizeText } from '@qr/core';
import {
  AdSlot,
  EmptyState,
  FilterPill,
  Icon,
  ICON_PATHS,
  Input,
  ProgressBar,
  ScreenTitle,
  StatusBadge,
  cn,
} from '@qr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useBreakpoint } from '../../components/use-breakpoint.ts';
import { env } from '../../env.ts';
import { useAds } from '../../lib/ads.ts';
import { useAppModel, type ItemRow } from '../../lib/model.ts';
import { useUi, type ItensFilter } from '../../lib/ui-store.ts';

const FILTERS: Array<[ItensFilter, string]> = [
  ['todos', 'Todos'],
  ['atencao', 'Precisa de atenção'],
  ['ok', 'Em dia'],
  ['none', 'Sem registro'],
];

const COLS = 'grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_120px_104px]';

interface Group {
  name: string;
  icon: string[];
  items: ItemRow[];
}

export function Itens() {
  const m = useAppModel();
  const navigate = useNavigate();
  const wide = useBreakpoint() !== 'mobile';
  const { itensFilter: filter, itensQuery: query, openCats, set } = useUi();
  const ads = useAds();

  const groups = useMemo(() => {
    const q = normalizeText(query);
    const passes = (r: ItemRow) =>
      (!q || normalizeText(r.item.name).includes(q)) &&
      (filter === 'todos' ||
        (filter === 'atencao' && (r.status.key === 'warn' || r.status.key === 'over')) ||
        r.status.key === filter);
    const map = new Map<string, Group>();
    for (const r of m.rows.filter(passes)) {
      const g = map.get(r.item.categoryName) ?? { name: r.item.categoryName, icon: r.item.icon, items: [] };
      g.items.push(r);
      map.set(r.item.categoryName, g);
    }
    return [...map.values()];
  }, [m.rows, query, filter]);

  const autoOpen = !!query || filter !== 'todos';

  return (
    <div className="flex flex-1 flex-col gap-[14px] px-[22px] pt-[22px] pb-6">
      <ScreenTitle>Itens</ScreenTitle>
      <Input
        aria-label="Buscar item"
        placeholder="Buscar item"
        value={query}
        onChange={e => set({ itensQuery: e.target.value, openCats: {} })}
      />
      <div className="flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Filtros">
        {FILTERS.map(([key, label]) => (
          <FilterPill key={key} active={filter === key} onClick={() => set({ itensFilter: key, openCats: {} })}>
            {label}
          </FilterPill>
        ))}
      </div>

      {groups.map(g => {
        const over = g.items.filter(r => r.status.key === 'over').length;
        const warn = g.items.filter(r => r.status.key === 'warn').length;
        const parts = [`${g.items.length} ${g.items.length === 1 ? 'item' : 'itens'}`];
        if (over) parts.push(`${over} vencido${over > 1 ? 's' : ''}`);
        if (warn) parts.push(`${warn} em atenção`);
        const open = openCats[g.name] ?? autoOpen;
        const panelId = `cat-${g.name}`;
        return (
          <div key={g.name} className="border-b border-border">
            <button
              type="button"
              onClick={() => set({ openCats: { ...openCats, [g.name]: !open } })}
              aria-expanded={open}
              aria-controls={panelId}
              className="flex min-h-[60px] w-full items-center gap-3 border-0 bg-transparent py-2.5 text-left"
            >
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-surface-3 text-primary">
                <Icon paths={g.icon} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold">{g.name}</span>
                <span className={cn('block text-[13px]', over ? 'text-over-fg' : warn ? 'text-warn-fg' : 'text-muted')}>
                  {parts.join(' · ')}
                </span>
              </span>
              <Icon
                paths={ICON_PATHS.chevronDown}
                className="flex-none text-ink transition-transform duration-200"
                style={{ transform: open ? 'rotate(180deg)' : 'none' }}
              />
            </button>
            {open ? (
              <div id={panelId} className="pb-2 pl-[52px]">
                {wide ? (
                  <div
                    className={cn(
                      'grid gap-4 border-b border-border py-2 text-[12px] font-semibold tracking-[.04em] text-subtle uppercase',
                      COLS,
                    )}
                  >
                    <span>Item</span>
                    <span>Situação</span>
                    <span>Progresso</span>
                    <span className="text-right">Status</span>
                  </div>
                ) : null}
                {g.items.map(r => (
                  <button
                    key={r.item.id}
                    type="button"
                    onClick={() => void navigate({ to: '/itens/$itemId', params: { itemId: r.item.id } })}
                    className={cn(
                      'grid w-full items-center gap-4 border-0 border-b border-border bg-transparent py-3 text-left transition-transform active:scale-98',
                      wide ? COLS : 'grid-cols-[minmax(0,1fr)_auto]',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-[15.5px] font-medium">{r.item.name}</div>
                      {!wide ? <div className="text-[13px] text-muted">{r.line}</div> : null}
                    </div>
                    {wide ? (
                      <>
                        <div className="min-w-0 text-[14px] text-ink-2">{r.line}</div>
                        <ProgressBar status={r.status.key} percent={r.barPct} height={6} label={r.item.name} />
                      </>
                    ) : null}
                    <StatusBadge status={r.status.key} size="sm" className="justify-self-end">
                      {r.badge}
                    </StatusBadge>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}

      {ads.show && groups.length > 0 ? (
        <AdSlot
          slot="itens-lista"
          size="in-feed"
          mode={env.adsMode}
          adsenseClient={env.adsenseClient ?? undefined}
          adsenseSlot={env.adsenseSlots.itens ?? undefined}
          onRemoveAds={ads.onRemove}
        />
      ) : null}
      {groups.length === 0 ? <EmptyState>Nenhum item encontrado.</EmptyState> : null}
    </div>
  );
}
