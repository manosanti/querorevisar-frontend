import { useEffect, type ReactNode } from 'react';
import { Conta } from '../features/conta/Conta.tsx';
import { Historico } from '../features/historico/Historico.tsx';
import { Itens } from '../features/itens/Itens.tsx';
import { Painel } from '../features/painel/Painel.tsx';
import { useUi, type Tab } from '../lib/ui-store.ts';

/** Remembers the last tab so overlays (/consultas) can keep it visible behind the panel. */
export function TabRoute({ tab, children }: { tab: Tab; children: ReactNode }) {
  useEffect(() => {
    if (useUi.getState().lastTab !== tab) useUi.setState({ lastTab: tab });
  }, [tab]);
  return <>{children}</>;
}

export function BackgroundTab() {
  const tab = useUi(s => s.lastTab);
  switch (tab) {
    case 'itens':
      return <Itens />;
    case 'historico':
      return <Historico />;
    case 'conta':
      return <Conta />;
    default:
      return <Painel />;
  }
}
