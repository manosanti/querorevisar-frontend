import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Login } from '../features/auth/Login.tsx';
import { useAuth } from '../lib/auth/store.ts';
import { useAppModel } from '../lib/model.ts';

type Search = { mode?: 'signin' | 'signup'; email?: string; provider?: 'google' | 'apple'; plan?: 'premium' };

export const Route = createFileRoute('/entrar')({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(s.mode === 'signup' || s.mode === 'signin' ? { mode: s.mode } : {}),
    ...(typeof s.email === 'string' ? { email: s.email } : {}),
    ...(s.provider === 'google' || s.provider === 'apple' ? { provider: s.provider } : {}),
    ...(s.plan === 'premium' ? { plan: 'premium' as const } : {}),
  }),
  component: EntrarRoute,
});

/**
 * The landing sends the typed e-mail in the fragment (#email=…), never in the query, so it stays out of
 * server logs. Read it once and remove it from the address bar before anything else (analytics) starts.
 */
function takeEmailFromHash(): string | null {
  const m = /(?:^#|&)email=([^&]*)/.exec(window.location.hash);
  if (!m) return null;
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  try {
    return decodeURIComponent(m[1] ?? '');
  } catch {
    return null;
  }
}

function EntrarRoute() {
  const { mode, email, provider, plan } = Route.useSearch();
  const [hashEmail] = useState(takeEmailFromHash);
  const auth = useAuth();
  const m = useAppModel();
  if (auth.status === 'loading') return null;
  // Already signed in with a real account: nothing to do here.
  if (auth.session && !auth.session.user.isAnonymous && m.loaded && m.vehicles.length)
    return <Navigate to={plan === 'premium' ? '/conta' : '/'} replace />;
  const initialEmail = hashEmail ?? email;
  return (
    <Login
      key={mode ?? 'signin'}
      initialMode={mode ?? (hashEmail || provider ? 'signup' : 'signin')}
      {...(initialEmail ? { initialEmail } : {})}
      {...(provider ? { autoProvider: provider } : {})}
      afterAuth={plan === 'premium' ? '/conta' : '/'}
    />
  );
}
