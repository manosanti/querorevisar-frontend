// Global states (docs/screens.md#estados-globais): discreet offline indicator, new PWA version prompt and
// the analytics consent banner (F12.2 — PostHog only starts after consent).
import { Button } from '@qr/ui';
import { env } from '../env.ts';
import { startAnalytics, stopAnalytics } from '../lib/analytics.ts';
import { useAuth } from '../lib/auth/store.ts';
import { useSyncStatus } from '../lib/data/sync.ts';
import { usePwa } from '../lib/pwa.ts';
import { useUi } from '../lib/ui-store.ts';

export function OfflineIndicator() {
  const online = useSyncStatus(s => s.online);
  const pending = useSyncStatus(s => s.pending);
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed top-0 left-1/2 z-35 -translate-x-1/2 rounded-b-12 bg-ink px-3 py-1 text-[12.5px] font-semibold text-white"
    >
      Sem conexão{pending ? ` · ${pending === 1 ? '1 alteração' : `${pending} alterações`} para enviar` : ''}
    </div>
  );
}

export function UpdatePrompt() {
  const ready = usePwa(s => s.updateReady);
  const apply = usePwa(s => s.applyUpdate);
  if (!ready) return null;
  return (
    <div
      role="status"
      className="fixed bottom-[90px] left-1/2 z-35 flex w-[calc(100%-32px)] max-w-[448px] -translate-x-1/2 items-center gap-3 rounded-14 bg-ink px-4 py-3 text-[14.5px] text-white shadow-toast tablet:bottom-6"
    >
      <span className="flex-1">Nova versão disponível</span>
      <button type="button" onClick={apply} className="border-0 bg-transparent p-1 font-semibold text-white underline">
        Atualizar
      </button>
    </div>
  );
}

export function ConsentBanner() {
  const consent = useUi(s => s.consent);
  const userId = useAuth(s => s.session?.user.id ?? null);
  if (!env.posthogKey || consent) return null;
  const decide = (value: 'granted' | 'denied') => {
    useUi.setState({ consent: value });
    if (value === 'granted') void startAnalytics(userId);
    else stopAnalytics();
  };
  return (
    <div
      role="dialog"
      aria-label="Privacidade"
      className="fixed bottom-[90px] left-1/2 z-35 flex w-[calc(100%-32px)] max-w-[448px] -translate-x-1/2 flex-col gap-3 rounded-16 border border-border bg-white p-4 shadow-dropdown tablet:bottom-6"
    >
      <div className="text-[14px] text-ink-2">
        Usamos dados de uso anônimos para melhorar o app. Nada de e-mail, nome ou placa.{' '}
        <a href={`${env.landingUrl}/privacidade`}>Saiba mais</a>
      </div>
      <div className="flex gap-2">
        <Button size="md" variant="outline-neutral" className="flex-1" onClick={() => decide('denied')}>
          Recusar
        </Button>
        <Button size="md" className="flex-1" onClick={() => decide('granted')}>
          Aceitar
        </Button>
      </div>
    </div>
  );
}
