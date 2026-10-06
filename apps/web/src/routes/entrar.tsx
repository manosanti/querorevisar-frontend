import { createFileRoute, Navigate } from '@tanstack/react-router';
import { Login } from '../features/auth/Login.tsx';
import { useAuth } from '../lib/auth/store.ts';
import { useAppModel } from '../lib/model.ts';

export const Route = createFileRoute('/entrar')({
  validateSearch: (s: Record<string, unknown>): { mode?: 'signin' | 'signup'; email?: string } => ({
    ...(s.mode === 'signup' || s.mode === 'signin' ? { mode: s.mode } : {}),
    ...(typeof s.email === 'string' ? { email: s.email } : {}),
  }),
  component: EntrarRoute,
});

function EntrarRoute() {
  const { mode, email } = Route.useSearch();
  const auth = useAuth();
  const m = useAppModel();
  if (auth.status === 'loading') return null;
  // Already signed in with a real account: nothing to do here.
  if (auth.session && !auth.session.user.isAnonymous && m.loaded && m.vehicles.length)
    return <Navigate to="/" replace />;
  return <Login key={mode ?? 'signin'} initialMode={mode ?? 'signin'} {...(email ? { initialEmail: email } : {})} />;
}
