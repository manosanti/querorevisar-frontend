import { configureHttp } from '@qr/api-client';
import { create } from 'zustand';
import { authMode, env } from '../../env.ts';
import { createDevAdapter } from './dev.ts';
import type { AuthAdapter, AuthSession } from './types.ts';

// supabase-js is only downloaded when Supabase is configured (keeps the initial bundle small in dev/mock).
let adapter: AuthAdapter | null = null;
const current = (): AuthAdapter => {
  if (!adapter) throw new Error('initAuth() must run first');
  return adapter;
};

/** Stable facade over the active adapter (Supabase or the API's local dev auth). */
export const auth: AuthAdapter = {
  get kind() {
    return current().kind;
  },
  getSession: () => current().getSession(),
  getAccessToken: () => current().getAccessToken(),
  onChange: cb => current().onChange(cb),
  signInAnonymously: () => current().signInAnonymously(),
  signUp: input => current().signUp(input),
  signIn: input => current().signIn(input),
  signInWithProvider: provider => current().signInWithProvider(provider),
  resetPassword: email => current().resetPassword(email),
  signOut: () => current().signOut(),
};

interface AuthState {
  status: 'loading' | 'ready';
  session: AuthSession | null;
}

export const useAuth = create<AuthState>(() => ({ status: 'loading', session: null }));

let initialized: Promise<void> | null = null;

/** Wires the HTTP client to the current token and keeps the store in sync with the adapter. */
export function initAuth(): Promise<void> {
  initialized ??= (async () => {
    adapter =
      authMode === 'supabase'
        ? (await import('./supabase.ts')).createSupabaseAdapter(env.supabaseUrl!, env.supabaseAnonKey!)
        : createDevAdapter();
    configureHttp({
      baseUrl: env.apiUrl,
      getToken: () => auth.getAccessToken(),
      onUnauthorized: () => {
        // A dev token from a previous API secret, or a deleted user: start over.
        if (auth.kind === 'dev') void auth.signOut();
      },
    });
    auth.onChange(session => useAuth.setState({ session, status: 'ready' }));
    const session = await auth.getSession();
    useAuth.setState({ session, status: 'ready' });
  })();
  return initialized;
}

export const currentUserId = (): string | null => useAuth.getState().session?.user.id ?? null;
