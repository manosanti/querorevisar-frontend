// Vehicle card and garage switcher of the Painel (docs/screens.md#painel).
import { cn } from './cn.ts';
import { ManageButton } from './button.tsx';
import { PlusIcon, VehicleImage, type VehicleKind } from './icons.tsx';

export interface GarageItem {
  id: string;
  name: string;
  type: VehicleKind;
  active: boolean;
}

/** Vehicle pills (48px) plus the round "+" button on the band. */
export function GarageSwitcher({
  vehicles,
  onPick,
  onAdd,
}: {
  vehicles: GarageItem[];
  onPick: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="-mx-[22px] flex gap-2 overflow-x-auto px-[22px] pt-0.5 pb-1">
      {vehicles.map(g => (
        <button
          key={g.id}
          type="button"
          aria-pressed={g.active}
          onClick={() => !g.active && onPick(g.id)}
          className={cn(
            'flex h-12 flex-none items-center gap-2 rounded-24 bg-white pr-[14px] pl-1.5 text-[14.5px] font-semibold whitespace-nowrap transition-transform active:scale-96',
            g.active ? 'border-2 border-primary' : 'border border-border',
          )}
        >
          <VehicleImage type={g.type} size={36} />
          {g.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onAdd}
        aria-label="Adicionar veículo"
        data-water="light"
        className="flex h-12 w-12 flex-none items-center justify-center rounded-full border-[1.5px] border-on-band-border bg-transparent text-white transition-transform active:scale-96"
      >
        <PlusIcon />
      </button>
    </div>
  );
}

export interface FipeInfo {
  when: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'flat';
}

interface VehicleCardProps {
  model: string;
  brand: string;
  year: string | number;
  type: VehicleKind;
  kmLabel: string;
  km: string;
  fipe: FipeInfo | null;
  showFipe: boolean;
  onManage: () => void;
  onUpdateKm: () => void;
}

/**
 * White card that rises -84px over the band. Stacked on mobile/tablet; a single 3-column row on desktop
 * (`1.1fr 1.2fr 1fr`, gap 24, padding 36/32, min height 200).
 */
export function VehicleCard({
  model,
  brand,
  year,
  type,
  kmLabel,
  km,
  fipe,
  showFipe,
  onManage,
  onUpdateKm,
}: VehicleCardProps) {
  const typeLabel = type === 'moto' ? 'Moto' : 'Carro';
  return (
    <section
      aria-label={`${brand} ${model}`}
      className={cn(
        'relative -mt-[84px] block rounded-20 bg-white p-[18px] shadow-card-vehicle',
        'desktop:grid desktop:min-h-[200px] desktop:items-center desktop:gap-6 desktop:px-8 desktop:py-9',
        showFipe
          ? 'desktop:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)]'
          : 'desktop:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)]',
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <div className="text-[22px] font-bold tracking-[-0.02em]">{model}</div>
          <div className="mt-0.5 text-[14px] text-muted">
            {brand} · {year}
          </div>
        </div>
        <VehicleImage type={type} size={88} alt={typeLabel} className="-mt-[14px] -mr-2 -mb-5" />
      </div>

      <div className="mt-[18px] flex items-end justify-between gap-2.5 desktop:mt-0 desktop:border-l desktop:border-divider desktop:pl-6">
        <div>
          <div className="text-[12.5px] text-muted">{kmLabel}</div>
          <div className="text-[30px] font-bold tracking-[-0.03em] tabular-nums" aria-live="off">
            {km}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ManageButton onClick={onManage} />
          <button
            type="button"
            onClick={onUpdateKm}
            data-water=""
            className="rounded-12 border border-primary bg-white px-4 py-2.5 text-[14px] font-semibold text-primary transition-transform active:scale-96"
          >
            Atualizar km
          </button>
        </div>
      </div>

      {showFipe ? (
        <div className="mt-4 flex items-center justify-between gap-2.5 border-t border-divider pt-[14px] desktop:mt-0 desktop:border-t-0 desktop:border-l desktop:pt-0 desktop:pl-6">
          <div className="min-w-0">
            <div className="text-[12.5px] text-muted">Tabela FIPE · {fipe ? fipe.when : 'carregando'}</div>
            <div className="text-[18px] font-bold tracking-[-0.02em] tabular-nums">{fipe ? fipe.value : '—'}</div>
          </div>
          {fipe ? (
            <span
              className={cn(
                'rounded-20 px-2.5 py-1 text-[12.5px] font-semibold whitespace-nowrap tabular-nums',
                fipe.trend === 'up' ? 'bg-primary-tint text-primary' : 'bg-surface-2 text-ink-2',
              )}
            >
              {fipe.delta}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
