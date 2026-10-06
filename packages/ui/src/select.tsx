// Equivalent of reference/QR Select.dc.html: searchable listbox with optional icons and sub-lines.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from './cn.ts';
import { Icon, ICON_PATHS, SearchIcon } from './icons.tsx';

export interface SelectOption {
  value: string;
  label: string;
  sub?: string;
  icon?: string;
}

export interface SelectProps {
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  options: ReadonlyArray<SelectOption | string>;
  value: string;
  onChange: (value: string, option: SelectOption) => void;
  disabled?: boolean;
  searchable?: boolean;
  helper?: string;
  error?: string;
  className?: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function Select({
  label,
  placeholder = 'Selecione',
  searchPlaceholder = 'Buscar',
  options,
  value,
  onChange,
  disabled,
  searchable,
  helper,
  error,
  className,
}: SelectProps) {
  const opts = useMemo<SelectOption[]>(
    () => options.map(o => (typeof o === 'string' ? { value: o, label: o } : o)),
    [options],
  );
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const labelId = useId();

  const filtered = useMemo(() => {
    const nq = norm(q);
    return opts.filter(o => !nq || norm(`${o.label} ${o.sub ?? ''}`).includes(nq));
  }, [opts, q]);
  const selected = opts.find(o => o.value === value);
  const showSearch = searchable ?? opts.length > 6;
  const hiIndex = Math.min(hi, filtered.length - 1);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [open]);

  const pick = (o: SelectOption) => {
    setOpen(false);
    setQ('');
    onChange(o.value, o);
    triggerRef.current?.focus();
  };

  const toggle = () => {
    if (disabled) return;
    setOpen(v => !v);
    setQ('');
    setHi(
      Math.max(
        0,
        opts.findIndex(o => o.value === value),
      ),
    );
  };

  const onListKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHi(Math.min(filtered.length - 1, hiIndex + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi(Math.max(0, hiIndex - 1));
    } else if (e.key === 'Enter' && filtered[hiIndex]) {
      e.preventDefault();
      pick(filtered[hiIndex]);
    }
  };

  const borderState = error
    ? 'border-over-fg shadow-[0_0_0_1px_var(--over-fg)]'
    : open
      ? 'border-primary shadow-[0_0_0_1px_var(--primary)]'
      : 'border-border';

  return (
    <div ref={rootRef} className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {label ? (
        <span id={labelId} className="text-[13.5px] font-semibold">
          {label}
        </span>
      ) : null}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
          onKeyDown={e => {
            if (e.key === 'ArrowDown' && !open) {
              e.preventDefault();
              toggle();
            } else if (open) onListKey(e);
          }}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-labelledby={label ? labelId : undefined}
          className={cn(
            'flex h-[52px] w-full items-center gap-2.5 rounded-8 border pr-[14px] text-left transition-[border-color,box-shadow] duration-150',
            selected?.icon ? 'pl-2' : 'pl-4',
            disabled ? 'cursor-not-allowed bg-surface-1 opacity-45' : 'bg-white',
            borderState,
          )}
        >
          {selected?.icon ? (
            <img src={selected.icon} alt="" className="h-[34px] w-[34px] shrink-0 object-contain" />
          ) : null}
          <span
            className={cn(
              'min-w-0 flex-1 overflow-hidden text-[16px] text-ellipsis whitespace-nowrap',
              selected ? 'text-ink' : 'text-subtle',
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <Icon
            paths={ICON_PATHS.chevronDown}
            className="shrink-0 text-muted transition-transform duration-200"
            style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </button>
        {open ? (
          <div className="absolute top-[calc(100%+6px)] right-0 left-0 z-50 overflow-hidden rounded-14 border border-border bg-white shadow-popover">
            {showSearch ? (
              <div className="border-b border-border p-2">
                <div className="flex h-[42px] items-center gap-2 rounded-8 border border-border bg-white px-3 text-muted">
                  <SearchIcon />
                  <input
                    ref={searchRef}
                    data-bare=""
                    value={q}
                    onChange={e => {
                      setQ(e.target.value);
                      setHi(0);
                    }}
                    onKeyDown={onListKey}
                    placeholder={searchPlaceholder}
                    aria-label="Buscar"
                    aria-controls={listId}
                    className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-0"
                  />
                </div>
              </div>
            ) : null}
            <div
              id={listId}
              role="listbox"
              aria-label={label}
              tabIndex={showSearch ? -1 : 0}
              onKeyDown={showSearch ? undefined : onListKey}
              className="max-h-[264px] overflow-y-auto p-1.5"
            >
              {filtered.map((o, i) => {
                const isSel = o.value === value;
                return (
                  <div
                    key={o.value}
                    role="option"
                    aria-selected={isSel}
                    onClick={() => pick(o)}
                    onMouseEnter={() => setHi(i)}
                    className={cn(
                      'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-10 px-2.5 py-2 text-left',
                      i === hiIndex ? 'bg-surface-1' : 'bg-transparent',
                    )}
                  >
                    {o.icon ? <img src={o.icon} alt="" className="h-[34px] w-[34px] shrink-0 object-contain" /> : null}
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-[15px]', isSel ? 'font-semibold' : 'font-medium')}>
                        {o.label}
                      </span>
                      {o.sub ? <span className="block text-[13px] text-muted">{o.sub}</span> : null}
                    </span>
                    {isSel ? (
                      <Icon paths={ICON_PATHS.check} strokeWidth={2.4} className="shrink-0 text-primary" />
                    ) : null}
                  </div>
                );
              })}
              {filtered.length === 0 ? (
                <div className="px-2.5 py-[18px] text-center text-[14px] text-muted">Nada encontrado para "{q}"</div>
              ) : null}
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
