// Logged-in area: needs a session (anonymous or not) and at least one active vehicle.
import { Button, EmptyState } from '@qr/ui';
import { createFileRoute, Navigate, Outlet } from '@tanstack/react-router';
import { AppShell } from '../components/AppShell.tsx';
import { PainelSkeleton, ShellSkeleton } from '../components/Skeletons.tsx';
import { useAuth } from '../lib/auth/store.ts';
import { refreshState, useSyncState } from '../lib/data/sync.ts';
import { useAppModel } from '../lib/model.ts';

export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

function AppLayout() {
  const auth = useAuth();
  const sync = useSyncState();
  const m = useAppModel();

  if (auth.status === 'loading') return <ShellSkeleton />;
  if (!auth.session) return <Navigate to="/entrar" replace />;
  if (!sync.data) {
    if (sync.isError) {
      return (
        <AppShell>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <EmptyState>Não foi possível carregar seus dados. Verifique a conexão.</EmptyState>
            <Button onClick={() => void refreshState({ full: true }).then(() => sync.refetch())}>Tentar de novo</Button>
          </div>
        </AppShell>
      );
    }
    return (
      <AppShell>
        <PainelSkeleton />
      </AppShell>
    );
  }
  if (!m.vehicle) return <Navigate to="/onboarding" search={{ modo: 'primeiro' }} replace />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
