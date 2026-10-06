import { createFileRoute, Navigate } from '@tanstack/react-router';
import { ShellSkeleton } from '../components/Skeletons.tsx';
import { Onboarding } from '../features/onboarding/Onboarding.tsx';
import { useAuth } from '../lib/auth/store.ts';
import { useSyncState } from '../lib/data/sync.ts';
import { useAppModel } from '../lib/model.ts';

type Modo = 'primeiro' | 'adicionar' | 'substituir';

export const Route = createFileRoute('/onboarding')({
  validateSearch: (s: Record<string, unknown>): { modo?: Modo; substitui?: string } => ({
    ...(s.modo === 'adicionar' || s.modo === 'substituir' || s.modo === 'primeiro' ? { modo: s.modo } : {}),
    ...(typeof s.substitui === 'string' ? { substitui: s.substitui } : {}),
  }),
  component: OnboardingRoute,
});

function OnboardingRoute() {
  const { modo = 'primeiro', substitui } = Route.useSearch();
  const auth = useAuth();
  const sync = useSyncState();
  const m = useAppModel();
  if (auth.status === 'loading') return <ShellSkeleton />;
  if (!auth.session) return <Navigate to="/entrar" replace />;
  if (!sync.data && sync.isPending) return <ShellSkeleton />;
  if (modo === 'primeiro' && m.vehicles.length) return <Navigate to="/" replace />;
  return <Onboarding mode={m.vehicles.length ? modo : 'primeiro'} {...(substitui ? { replaceId: substitui } : {})} />;
}
