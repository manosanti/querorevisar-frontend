// Responsive shell: bottom tabs (<768), 88px rail (768–1099), 248px sidebar (>=1100). docs/screens.md#shell
import { BottomTabs, RouteBar, SideNav, TAB_ICONS, type NavItem } from '@qr/ui';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth/store.ts';
import { useAppModel } from '../lib/model.ts';
import { openSheet, useUi, type Tab } from '../lib/ui-store.ts';
import { useBreakpoint } from './use-breakpoint.ts';

const TABS: Array<{ key: Tab; label: string; href: string }> = [
  { key: 'painel', label: 'Painel', href: '/' },
  { key: 'itens', label: 'Itens', href: '/itens' },
  { key: 'historico', label: 'Histórico', href: '/historico' },
  { key: 'conta', label: 'Conta', href: '/conta' },
];

export function tabForPath(pathname: string): Tab | null {
  if (pathname === '/') return 'painel';
  if (pathname.startsWith('/itens')) return 'itens';
  if (pathname.startsWith('/historico')) return 'historico';
  if (pathname.startsWith('/conta')) return 'conta';
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const bp = useBreakpoint();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const pending = useRouterState({ select: s => s.status === 'pending' });
  const lastTab = useUi(s => s.lastTab);
  const current = tabForPath(pathname) ?? lastTab;
  const model = useAppModel();
  const session = useAuth(s => s.session);

  const items: NavItem[] = TABS.map(t => ({
    key: t.key,
    label: t.label,
    icon: TAB_ICONS[t.key],
    active: current === t.key,
    href: t.href,
    onSelect: () => void navigate({ to: t.href }),
  }));

  const name = !model.isAnonymous ? (model.me?.name ?? session?.user.name ?? null) : null;
  const letter = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className="min-h-screen bg-page">
      <div className="relative mx-auto flex min-h-screen max-w-[480px] flex-col bg-white shadow-shell-mobile tablet:max-w-none tablet:flex-row">
        {bp !== 'mobile' ? (
          <SideNav
            variant={bp === 'desktop' ? 'full' : 'rail'}
            items={items}
            onRegister={() => openSheet({ type: 'register' })}
            onLookup={() => void navigate({ to: '/consultas' })}
            lookupHref="/consultas"
            logoSrc="/brand/logo-horizontal.webp"
            iconSrc="/brand/icone.webp"
            user={{
              letter,
              name: name ?? 'Conta',
              sub: `Plano ${model.plan === 'free' ? 'Grátis' : 'Premium'} · ${model.creditsLabel}`,
              onSelect: () => void navigate({ to: '/conta' }),
            }}
          />
        ) : null}
        <div className="mx-auto flex w-full min-w-0 flex-1 flex-col tablet:max-w-[780px] desktop:max-w-[1200px]">
          {pending ? <RouteBar /> : null}
          <main className="flex flex-1 flex-col">{children}</main>
          {bp === 'mobile' ? <BottomTabs items={items} /> : null}
        </div>
      </div>
    </div>
  );
}

export function useAvatarLetter(): string {
  const model = useAppModel();
  const session = useAuth(s => s.session);
  const name = !model.isAnonymous ? (model.me?.name ?? session?.user.name ?? null) : null;
  return name ? name.charAt(0).toUpperCase() : '?';
}
