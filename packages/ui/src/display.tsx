import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn.ts';

export type DueStatus = 'none' | 'ok' | 'warn' | 'over';
export type Tone = 'ok' | 'warn' | 'over';

// ---- status colors (prototype STATUS map) ---------------------------------------------------------
const STATUS_BADGE: Record<DueStatus, string> = {
  over: 'text-over-fg bg-over-bg',
  warn: 'text-warn-fg bg-warn-bg',
  ok: 'text-ink-2 bg-surface-2',
  none: 'text-none-fg bg-white',
};
const STATUS_BAR: Record<DueStatus, string> = {
  over: 'bg-over-bar',
  warn: 'bg-warn-bar',
  ok: 'bg-primary',
  none: 'bg-border',
};
// Lookup rows and info badges: "ok" is teal (TONE map of the prototype).
const TONE_BADGE: Record<Tone, string> = {
  ok: 'text-primary bg-primary-tint',
  warn: 'text-warn-fg bg-warn-bg',
  over: 'text-over-fg bg-over-bg',
};

interface BadgeProps {
  children: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

/** Due-status pill: "Vencido", "Atenção 85%", "Em dia", "Sem registro". */
export function StatusBadge({
  status,
  children,
  size = 'md',
  className,
  filledNone,
}: BadgeProps & { status: DueStatus; filledNone?: boolean }) {
  return (
    <span
      className={cn(
        'inline-block rounded-20 font-semibold whitespace-nowrap',
        size === 'md' ? 'px-2.5 py-1 text-[12.5px]' : 'px-[9px] py-[3px] text-[12px]',
        status === 'none' && filledNone ? 'bg-surface-2 text-none-fg' : STATUS_BADGE[status],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Tone pill for lookup rows ("Nada consta", "Pago") and info labels ("Ativo"). */
export function ToneBadge({ tone, children, size = 'md', className }: BadgeProps & { tone: Tone }) {
  return (
    <span
      className={cn(
        'inline-block rounded-20 font-semibold',
        size === 'md' ? 'px-2.5 py-1 text-[13px]' : 'px-2.5 py-1 text-[12.5px]',
        TONE_BADGE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  status,
  percent,
  height = 4,
  label,
  className,
}: {
  status: DueStatus;
  percent: number;
  height?: 4 | 6;
  label?: string;
  className?: string;
}) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={p}
      aria-label={label}
      className={cn('w-full bg-track', height === 4 ? 'h-1 rounded-4' : 'h-1.5 rounded-[6px]', className)}
    >
      <div
        className={cn('h-full', height === 4 ? 'rounded-4' : 'rounded-[6px]', STATUS_BAR[status])}
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

const TILE: Record<'over' | 'warn' | 'ok', { box: string; num: string; label: string }> = {
  over: { box: 'bg-over-bg', num: 'text-over-fg', label: 'text-over-label' },
  warn: { box: 'bg-warn-bg', num: 'text-warn-fg', label: 'text-warn-label' },
  ok: { box: 'bg-surface-2', num: 'text-ink', label: 'text-ink-2' },
};

/** Painel counters (vencido / em atenção / em dia) that open Itens filtered. */
export function StatTile({
  tone,
  value,
  label,
  className,
  ...rest
}: { tone: 'over' | 'warn' | 'ok'; value: number; label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const t = TILE[tone];
  return (
    <button
      type="button"
      className={cn('flex-1 rounded-14 border-0 p-3 text-left transition-transform active:scale-96', t.box, className)}
      {...rest}
    >
      <div className={cn('text-[24px] font-bold tabular-nums', t.num)}>{value}</div>
      <div className={cn('text-[13px] font-medium', t.label)}>{label}</div>
    </button>
  );
}

/** Static info tile (Histórico "Trocas registradas", "Gasto informado"). */
export function InfoTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-14 bg-surface-2 px-[14px] py-3">
      <div className="text-[12.5px] text-muted">{label}</div>
      <div className="text-[22px] font-bold tabular-nums">{value}</div>
    </div>
  );
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-20 border border-border p-[18px]', className)} {...rest} />;
}

/** Tinted information box (teal) or neutral box (surface-2). */
export function Notice({
  tone = 'teal',
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: 'teal' | 'neutral' }) {
  return (
    <div
      className={cn(
        'rounded-14 px-[14px] py-3 text-[14px] text-pretty',
        tone === 'teal' ? 'bg-primary-tint text-primary-strong' : 'bg-surface-2 text-ink-2',
        className,
      )}
      {...rest}
    />
  );
}

export function SectionTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('m-0 text-[22px] font-semibold tracking-[-0.02em]', className)} {...rest} />;
}

export function ScreenTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h1 className={cn('m-0 text-[28px] font-bold tracking-[-0.01em]', className)} {...rest} />;
}

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" className={cn('qr-skeleton rounded-[6px]', className)} style={style} />;
}

export function EmptyState({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('py-[30px] text-center text-muted', className)}>{children}</div>;
}

/** Filter pill: 2px primary border and 600 weight when active. */
export function FilterPill({
  active,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={!!active}
      className={cn(
        'rounded-20 bg-white px-[14px] py-2 text-[14px] whitespace-nowrap transition-transform active:scale-96',
        active ? 'border-2 border-primary font-semibold' : 'border border-border font-medium',
        className,
      )}
      {...rest}
    />
  );
}

/** "+ Item" chip with the water hover. */
export function Chip({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      data-water=""
      className={cn(
        'rounded-20 border border-border bg-white px-[14px] py-2 text-[14px] transition-transform active:scale-96',
        className,
      )}
      {...rest}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-1 rounded-12 bg-surface-3 p-1">
      {options.map(o => {
        const sel = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={sel}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-10 rounded-9 border-0 text-[14px] font-semibold',
              sel ? 'bg-white shadow-segmented' : 'bg-transparent',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Selectable card with a radio dot (lookup products, credit packs). */
export function RadioCard({
  selected,
  children,
  aside,
  align = 'center',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  selected: boolean;
  aside?: ReactNode;
  align?: 'center' | 'start';
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cn(
        'flex w-full gap-3 rounded-14 bg-white p-[14px] text-left transition-transform active:scale-98',
        align === 'start' ? 'items-start' : 'items-center',
        selected ? 'border-2 border-primary' : 'border border-border',
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-5 w-5 shrink-0 rounded-full bg-white',
          align === 'start' && 'mt-0.5',
          selected ? 'border-[6px] border-primary' : 'border-2 border-control-border',
        )}
      />
      <span className="min-w-0 flex-1">{children}</span>
      {aside ? <span className="shrink-0 text-right">{aside}</span> : null}
    </button>
  );
}

/** Small tag pill ("Antes de comprar", "Mais escolhido"). */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-20 bg-primary-tint px-2 py-0.5 text-[11.5px] font-bold text-primary">{children}</span>
  );
}

export function PlateTag({ plate, size = 'sm' }: { plate: string; size?: 'sm' | 'lg' }) {
  return (
    <span
      className={cn(
        'shrink-0 self-start border-ink font-bold',
        size === 'sm'
          ? 'rounded-6 border-[1.5px] px-2 py-1 text-[13px] tracking-[.08em]'
          : 'rounded-8 border-2 px-3 py-1.5 text-[20px] tracking-[.12em]',
      )}
    >
      {plate}
    </span>
  );
}

export type AdMode = 'placeholder' | 'adsense' | 'off';

/** Ad slot: dashed placeholder box (ADS_MODE=placeholder) or an AdSense unit. Never on Painel/alerts. */
export function AdSlot({
  slot,
  size,
  mode,
  onRemoveAds,
  adsenseClient,
  adsenseSlot,
}: {
  slot: 'itens-lista' | 'historico-rodape' | 'conta-rodape';
  size: 'in-feed' | 'rectangle';
  mode: AdMode;
  onRemoveAds: () => void;
  adsenseClient?: string | undefined;
  adsenseSlot?: string | undefined;
}) {
  if (mode === 'off') return null;
  const height = size === 'in-feed' ? 100 : 250;
  return (
    <div
      data-ad-slot={slot}
      className="my-3 flex flex-col items-center justify-center gap-0.5 rounded-14 border border-dashed border-ad-border bg-surface-1 px-3 text-center"
      style={{ height }}
    >
      <span className="text-[11.5px] font-semibold tracking-[.04em] text-subtle uppercase">Publicidade</span>
      {mode === 'adsense' && adsenseClient && adsenseSlot ? (
        <ins
          className="adsbygoogle block w-full"
          style={{ display: 'block', height: height - 40 }}
          data-ad-client={adsenseClient}
          data-ad-slot={adsenseSlot}
          data-ad-format={size === 'in-feed' ? 'fluid' : 'rectangle'}
        />
      ) : (
        <span className="text-[12.5px] text-subtle">
          {size === 'in-feed' ? 'AdSense · in-feed responsivo · altura 100 px' : 'AdSense · retângulo médio 300 × 250'}
        </span>
      )}
      <button
        type="button"
        onClick={onRemoveAds}
        className="mt-1 border-0 bg-transparent p-1 text-[12.5px] font-semibold text-primary underline"
      >
        Remover anúncios
      </button>
    </div>
  );
}

/** 3px progress bar at the top while a route loads. */
export function RouteBar() {
  return (
    <div
      role="progressbar"
      aria-label="Carregando"
      className="sticky top-0 z-15 h-[3px] overflow-hidden bg-primary-tint"
    >
      <div className="qr-routebar h-full w-1/2 rounded-[3px] bg-primary" />
    </div>
  );
}
