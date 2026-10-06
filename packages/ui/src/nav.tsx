// App navigation: bottom tabs (<768), 88px rail (768–1099) and 248px sidebar (>=1100). docs/screens.md#shell
import type { MouseEvent, ReactNode } from 'react';
import { cn } from './cn.ts';
import { Icon, PlusIcon, TAB_ICONS } from './icons.tsx';

export interface NavItem {
  key: string;
  label: string;
  icon: readonly string[];
  active: boolean;
  href: string;
  onSelect: () => void;
}

function navClick(onSelect: () => void) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onSelect();
  };
}

export function BottomTabs({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="sticky bottom-0 z-10 grid h-[74px] shrink-0 grid-cols-4 border-t border-border bg-white pt-2"
    >
      {items.map(t => (
        <a
          key={t.key}
          href={t.href}
          onClick={navClick(t.onSelect)}
          aria-current={t.active ? 'page' : undefined}
          className={cn(
            'flex flex-col items-center gap-1 text-[12px] font-semibold no-underline transition-transform active:scale-96 hover:no-underline',
            t.active ? 'text-primary hover:text-primary' : 'text-subtle hover:text-subtle',
          )}
        >
          <Icon paths={t.icon} size={22} strokeWidth={1.9} />
          {t.label}
        </a>
      ))}
    </nav>
  );
}

interface SideNavProps {
  variant: 'full' | 'rail';
  items: NavItem[];
  onRegister: () => void;
  onLookup: () => void;
  lookupHref: string;
  logoSrc: string;
  iconSrc: string;
  user: { letter: string; name: string; sub: string; onSelect: () => void };
}

export function SideNav({ variant, items, onRegister, onLookup, lookupHref, logoSrc, iconSrc, user }: SideNavProps) {
  const full = variant === 'full';
  const itemClass = (active: boolean) =>
    cn(
      'no-underline hover:no-underline',
      active ? 'bg-primary-tint text-primary hover:text-primary' : 'bg-transparent text-ink hover:text-ink',
      full
        ? 'flex h-11 items-center gap-3 rounded-10 px-3 text-left text-[15px] font-semibold'
        : 'flex flex-col items-center gap-1 rounded-12 py-[9px] text-[11.5px] font-semibold',
    );

  return (
    <aside
      className={cn(
        'sticky top-0 z-10 flex h-screen shrink-0 flex-col gap-5 border-r border-border bg-white',
        full ? 'w-[248px] px-4 py-6' : 'w-[88px] px-2.5 py-[22px]',
      )}
    >
      {full ? (
        <img src={logoSrc} alt="QueroRevisar" className="mx-2.5 my-1 h-[30px] w-auto self-start" />
      ) : (
        <img src={iconSrc} alt="QueroRevisar" className="h-11 w-11 self-center" />
      )}
      {full ? (
        <button
          type="button"
          onClick={onRegister}
          className="flex h-[46px] items-center justify-center gap-2 rounded-10 border-0 bg-primary text-[15px] font-semibold text-white transition-transform active:scale-96"
        >
          <PlusIcon />
          Registrar troca
        </button>
      ) : (
        <button
          type="button"
          onClick={onRegister}
          aria-label="Registrar troca"
          title="Registrar troca"
          className="flex h-[52px] w-[52px] items-center justify-center self-center rounded-16 border-0 bg-primary text-white transition-transform active:scale-96"
        >
          <PlusIcon />
        </button>
      )}
      <nav aria-label="Navegação principal" className={cn('flex flex-col', full ? 'gap-1' : 'gap-1.5')}>
        {items.map(t => (
          <a
            key={t.key}
            href={t.href}
            onClick={navClick(t.onSelect)}
            aria-current={t.active ? 'page' : undefined}
            className={itemClass(t.active)}
          >
            <Icon paths={t.icon} size={20} strokeWidth={1.9} />
            {t.label}
          </a>
        ))}
        <a href={lookupHref} onClick={navClick(onLookup)} className={itemClass(false)}>
          <Icon paths={TAB_ICONS.consultas} size={20} strokeWidth={1.9} />
          {full ? 'Consultar placa' : 'Consultas'}
        </a>
      </nav>
      {full ? (
        <button
          type="button"
          onClick={user.onSelect}
          className="mt-auto flex items-center gap-2.5 rounded-12 border-0 bg-surface-1 p-2.5 text-left"
        >
          <Avatar letter={user.letter} size={36} />
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold">{user.name}</span>
            <span className="block text-[12.5px] text-muted">{user.sub}</span>
          </span>
        </button>
      ) : null}
    </aside>
  );
}

export function Avatar({
  letter,
  size = 36,
  onClick,
  label,
}: {
  letter: string;
  size?: number;
  onClick?: () => void;
  label?: string;
}) {
  const cls = 'flex shrink-0 items-center justify-center rounded-full border-0 bg-primary-tint font-bold text-primary';
  const style = { width: size, height: size, fontSize: size >= 52 ? 20 : 14 };
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label ?? 'Conta'}
        className={cn(cls, 'font-semibold transition-transform active:scale-96')}
        style={style}
      >
        {letter}
      </button>
    );
  }
  return (
    <span aria-hidden="true" className={cls} style={style}>
      {letter}
    </span>
  );
}

/** Wrapper used by the shell for the main column next to the navigation. */
export function MainColumn({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto flex w-full min-w-0 flex-1 flex-col', className)}>{children}</div>;
}
