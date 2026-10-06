// Equivalent of reference/QR DatePicker.dc.html: month grid, year grid, "Hoje" and a clear action.
import { useEffect, useRef, useState } from 'react';
import { cn } from './cn.ts';
import { CalendarIcon, Icon, ICON_PATHS } from './icons.tsx';

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => {
  const t = new Date();
  return isoOf(t.getFullYear(), t.getMonth(), t.getDate());
};

export interface DatePickerProps {
  label?: string;
  placeholder?: string;
  /** YYYY-MM-DD or empty string. */
  value: string;
  onChange: (value: string) => void;
  /** 'today' or a YYYY-MM-DD upper bound. */
  max?: string;
  minYear?: number;
  clearLabel?: string;
  helper?: string;
  error?: string;
}

export function DatePicker({
  label,
  placeholder = 'Selecione a data',
  value,
  onChange,
  max,
  minYear,
  clearLabel = 'Limpar',
  helper,
  error,
}: DatePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const initial = value ? new Date(`${value}T12:00`) : new Date();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'days' | 'years'>('days');
  const [y, setY] = useState(initial.getFullYear());
  const [m, setM] = useState(initial.getMonth());

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const maxIso = max === 'today' ? todayIso() : (max ?? null);
  const tIso = todayIso();
  const first = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const maxY = maxIso ? Number(maxIso.slice(0, 4)) : new Date().getFullYear() + 5;
  const minY = minYear ?? maxY - 20;
  const nextBlocked = !!maxIso && isoOf(y, m, 1) >= `${maxIso.slice(0, 8)}01`;
  const selected = value ? new Date(`${value}T12:00`) : null;

  const set = (v: string) => {
    setOpen(false);
    onChange(v);
  };

  const toggle = () => {
    const d = value ? new Date(`${value}T12:00`) : new Date();
    setOpen(o => !o);
    setMode('days');
    setY(d.getFullYear());
    setM(d.getMonth());
  };

  const borderState = error
    ? 'border-over-fg shadow-[0_0_0_1px_var(--over-fg)]'
    : open
      ? 'border-primary shadow-[0_0_0_1px_var(--primary)]'
      : 'border-border';

  const navBtn =
    'flex h-9 w-9 items-center justify-center rounded-full border-0 bg-surface-3 text-ink disabled:cursor-not-allowed disabled:opacity-35';

  return (
    <div ref={rootRef} className="flex min-w-0 flex-col gap-1.5">
      {label ? <span className="text-[13.5px] font-semibold">{label}</span> : null}
      <div className="relative">
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={label ? `${label}: ${selected ? selected.toLocaleDateString('pt-BR') : placeholder}` : undefined}
          className={cn(
            'flex h-[52px] w-full items-center gap-2.5 rounded-8 border bg-white pr-[14px] pl-4 text-left transition-[border-color,box-shadow] duration-150',
            borderState,
          )}
        >
          <span className="shrink-0 text-muted">
            <CalendarIcon />
          </span>
          <span
            className={cn(
              'min-w-0 flex-1 overflow-hidden text-[16px] text-ellipsis whitespace-nowrap',
              selected ? 'text-ink' : 'text-subtle',
            )}
          >
            {selected
              ? selected.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
              : placeholder}
          </span>
          <Icon
            paths={ICON_PATHS.chevronDown}
            className="shrink-0 text-muted transition-transform duration-200"
            style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </button>

        {open ? (
          <div
            role="dialog"
            aria-label="Escolher data"
            className="absolute top-[calc(100%+6px)] left-0 z-50 w-[320px] max-w-[calc(100vw-32px)] rounded-16 border border-border bg-white p-[14px] shadow-popover"
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Anterior"
                className={navBtn}
                onClick={() => {
                  if (mode === 'years') return;
                  if (m === 0) {
                    setM(11);
                    setY(y - 1);
                  } else setM(m - 1);
                }}
              >
                <Icon paths={ICON_PATHS.chevronLeft} size={16} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                onClick={() => setMode(mode === 'years' ? 'days' : 'years')}
                className="flex items-center gap-1 rounded-8 border-0 bg-transparent px-2.5 py-1.5 text-[16px] font-semibold text-ink"
              >
                {mode === 'years' ? 'Escolha o ano' : `${MONTHS[m]} ${y}`}
                <Icon
                  paths={ICON_PATHS.chevronDown}
                  size={14}
                  strokeWidth={2.2}
                  style={{ transform: mode === 'years' ? 'rotate(180deg)' : 'none' }}
                />
              </button>
              <button
                type="button"
                aria-label="Próximo"
                className={navBtn}
                disabled={nextBlocked}
                onClick={() => {
                  if (mode === 'years' || nextBlocked) return;
                  if (m === 11) {
                    setM(0);
                    setY(y + 1);
                  } else setM(m + 1);
                }}
              >
                <Icon paths={ICON_PATHS.chevronRight} size={16} strokeWidth={2.2} />
              </button>
            </div>

            {mode === 'days' ? (
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {WEEKDAYS.map((w, i) => (
                  <div
                    key={`${w}${i}`}
                    className="flex h-7 items-center justify-center text-[12px] font-semibold text-subtle"
                  >
                    {w}
                  </div>
                ))}
                {Array.from({ length: first }, (_, i) => (
                  <span key={`pad${i}`} aria-hidden="true" />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = i + 1;
                  const iso = isoOf(y, m, d);
                  const sel = iso === value;
                  const dis = !!maxIso && iso > maxIso;
                  const today = iso === tIso;
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={dis}
                      aria-label={`${d} de ${MONTHS[m]}`}
                      aria-pressed={sel}
                      onClick={() => set(iso)}
                      className={cn(
                        'h-10 rounded-full border text-[14.5px] tabular-nums',
                        sel
                          ? 'border-transparent bg-primary font-bold text-white'
                          : today
                            ? 'border-primary bg-transparent font-bold text-ink'
                            : 'border-transparent bg-transparent font-medium',
                        dis && 'cursor-not-allowed text-control-border',
                        !sel && !dis && 'text-ink',
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid max-h-[268px] grid-cols-3 gap-2 overflow-y-auto">
                {Array.from({ length: maxY - minY + 1 }, (_, i) => maxY - i).map(year => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setY(year);
                      setMode('days');
                    }}
                    className={cn(
                      'h-11 rounded-[22px] border text-[15px] font-semibold tabular-nums',
                      year === y ? 'border-primary bg-primary text-white' : 'border-border bg-white text-ink',
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 flex justify-between gap-2 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => set('')}
                className="border-0 bg-transparent px-1 py-2 text-[14.5px] font-semibold text-ink underline"
              >
                {clearLabel}
              </button>
              <button
                type="button"
                onClick={() => set(tIso)}
                className="h-[38px] rounded-[19px] border border-primary bg-white px-4 text-[14px] font-semibold text-primary"
              >
                Hoje
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {error || helper ? (
        <span className={cn('text-[13px]', error ? 'text-over-fg' : 'text-muted')}>{error ?? helper}</span>
      ) : null}
    </div>
  );
}
