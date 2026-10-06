// Local dev auth (no Supabase): the API issues tokens through /dev/auth/* (AUTH_MODE=dev, local profile only).
import { api, ApiError, type DevSession } from '@qr/api-client';
import { AuthError, type AuthAdapter, type AuthSession } from './types.ts';

const KEY = 'qr-dev-session';

function read(): AuthSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AuthSession & { expiresAt?: string };
    if (s.expiresAt && Date.parse(s.expiresAt) < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

function toSession(d: DevSession): AuthSession {
  return {
    accessToken: d.accessToken,
    user: { id: d.user.id, isAnonymous: d.user.isAnonymous, email: d.user.email, name: d.user.name },
  };
}

function translate(err: unknown): never {
  if (err instanceof ApiError) {
    if (err.status === 401) throw new AuthError('E-mail ou senha incorretos');
    if (err.status === 409) throw new AuthError('Este e-mail já tem conta. Entre com a senha.');
    throw new AuthError(err.problem.title);
  }
  throw new AuthError('Não foi possível entrar agora. Tente de novo.');
}

export function createDevAdapter(): AuthAdapter {
  const listeners = new Set<(s: AuthSession | null) => void>();
  let session = read();

  const save = (d: DevSession | null) => {
    session = d ? toSession(d) : null;
    if (d) localStorage.setItem(KEY, JSON.stringify({ ...session, expiresAt: d.expiresAt }));
    else localStorage.removeItem(KEY);
    for (const l of listeners) l(session);
    return session;
  };

  const run = async (fn: () => Promise<DevSession>) => {
    try {
      return save(await fn())!;
    } catch (err) {
      return translate(err);
    }
  };

  return {
    kind: 'dev',
    async getSession() {
      return session;
    },
    async getAccessToken() {
      return session?.accessToken ?? null;
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    signInAnonymously: () => run(() => api.devAuthAnonymous()),
    signUp: input => run(() => api.devAuthSignup(input)),
    signIn: input => run(() => api.devAuthSignin(input)),
    async signInWithProvider(provider) {
      return run(() => api.devAuthOauth({ provider }));
    },
    async resetPassword(email) {
      try {
        await api.devAuthRecover({ email });
      } catch (err) {
        translate(err);
      }
    },
    async signOut() {
      save(null);
    },
  };
}
