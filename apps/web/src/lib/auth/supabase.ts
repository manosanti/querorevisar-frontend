// Supabase Auth adapter. supabase-js is used ONLY for authentication; data always goes through the API.
import { createClient, type AuthError as SupabaseAuthError, type Session } from '@supabase/supabase-js';
import { AuthError, type AuthAdapter, type AuthSession, type OAuthProvider } from './types.ts';

function toSession(s: Session | null): AuthSession | null {
  if (!s) return null;
  const meta = (s.user.user_metadata ?? {}) as { name?: string; full_name?: string };
  return {
    accessToken: s.access_token,
    user: {
      id: s.user.id,
      isAnonymous: !!s.user.is_anonymous,
      email: s.user.email ?? null,
      name: meta.name ?? meta.full_name ?? null,
    },
  };
}

function translate(err: SupabaseAuthError | null): never | void {
  if (!err) return;
  const msg = err.message.toLowerCase();
  if (msg.includes('invalid login credentials')) throw new AuthError('E-mail ou senha incorretos');
  if (msg.includes('already registered') || msg.includes('already been registered') || err.code === 'email_exists')
    throw new AuthError('Este e-mail já tem conta. Entre com a senha.');
  if (msg.includes('password')) throw new AuthError('A senha precisa ter pelo menos 6 caracteres');
  if (msg.includes('rate limit')) throw new AuthError('Muitas tentativas. Espere um pouco e tente de novo.');
  throw new AuthError('Não foi possível entrar agora. Tente de novo.');
}

export function createSupabaseAdapter(url: string, anonKey: string): AuthAdapter {
  const client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'qr-auth' },
  });
  const redirectTo = `${window.location.origin}/entrar`;

  const current = async () => {
    const { data } = await client.auth.getSession();
    return data.session;
  };

  return {
    kind: 'supabase',
    async getSession() {
      return toSession(await current());
    },
    async getAccessToken() {
      return (await current())?.access_token ?? null;
    },
    onChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event, session) => cb(toSession(session)));
      return () => data.subscription.unsubscribe();
    },
    async signInAnonymously() {
      const { data, error } = await client.auth.signInAnonymously();
      translate(error);
      return toSession(data.session)!;
    },
    async signUp({ name, email, password }) {
      const session = await current();
      if (session?.user.is_anonymous) {
        // Converting the anonymous user keeps its id, so every vehicle and record stays with the account.
        const { error } = await client.auth.updateUser({ email, password, data: { name } });
        translate(error);
        const { data } = await client.auth.refreshSession();
        return toSession(data.session ?? (await current()))!;
      }
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { name }, emailRedirectTo: redirectTo },
      });
      translate(error);
      if (!data.session) throw new AuthError(`Enviamos um link para ${email}`);
      return toSession(data.session)!;
    },
    async signIn({ email, password }) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      translate(error);
      return toSession(data.session)!;
    },
    async signInWithProvider(provider: OAuthProvider) {
      const session = await current();
      if (session?.user.is_anonymous) {
        const { error } = await client.auth.linkIdentity({ provider, options: { redirectTo } });
        translate(error);
      } else {
        const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo } });
        translate(error);
      }
      return 'redirect';
    },
    async resetPassword(email) {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      translate(error);
    },
    async signOut() {
      await client.auth.signOut();
    },
  };
}
