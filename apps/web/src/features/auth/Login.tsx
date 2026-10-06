// Login / cadastro (docs/screens.md#login). Creating an account from the anonymous user keeps its data
// (Supabase updateUser/linkIdentity, or the dev auth link).
import { AppleIcon, BackButton, Button, GoogleIcon, Input, toast } from '@qr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { env } from '../../env.ts';
import { auth, useAuth } from '../../lib/auth/store.ts';
import { AuthError, type AuthSession } from '../../lib/auth/types.ts';
import { clearQueryCache } from '../../lib/data/query.ts';
import { clearOutbox, refreshState } from '../../lib/data/sync.ts';
import { useAppModel } from '../../lib/model.ts';
import { goBack } from '../../lib/navigation.ts';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Login({ initialMode, initialEmail }: { initialMode: 'signin' | 'signup'; initialEmail?: string }) {
  const navigate = useNavigate();
  const m = useAppModel();
  const session = useAuth(s => s.session);
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasVehicle = m.vehicles.length > 0;
  const canClose = hasVehicle;
  const appleLogin = m.me?.flags.appleLogin ?? false;
  const signin = mode === 'signin';

  /** Signing in as another user: local data of the previous (anonymous) user is dropped. */
  const switchUser = async (previous: AuthSession | null, next: AuthSession) => {
    if (previous && previous.user.id !== next.user.id) {
      await clearOutbox(previous.user.id);
      await clearQueryCache();
    }
  };

  const finish = async (next: AuthSession, kind: 'signin' | 'signup') => {
    await refreshState({ full: true });
    const displayName = capitalize(next.user.name ?? next.user.email?.split('@')[0] ?? '');
    if (kind === 'signin') toast(`Bem-vindo de volta, ${displayName}`);
    else toast(hasVehicle ? 'Conta criada · registros salvos' : 'Conta criada · agora cadastre seu veículo');
    void navigate({ to: '/', replace: true });
  };

  const submit = async () => {
    if (mode === 'signup' && !name.trim()) return toast('Informe seu nome', 'err');
    if (!EMAIL.test(email)) return toast('E-mail inválido. Confira e tente de novo', 'err');
    if (pw.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres', 'err');
    setBusy(true);
    try {
      const previous = useAuth.getState().session;
      if (signin) {
        const next = await auth.signIn({ email, password: pw });
        await switchUser(previous, next);
        await finish(next, 'signin');
      } else {
        const next = await auth.signUp({ name: name.trim(), email, password: pw });
        await switchUser(previous, next);
        await finish(next, 'signup');
      }
    } catch (err) {
      toast(err instanceof AuthError ? err.message : 'Não foi possível entrar agora. Tente de novo.', 'err');
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!EMAIL.test(email)) return toast('Digite seu e-mail para recuperar a senha', 'err');
    try {
      await auth.resetPassword(email);
      toast(`Enviamos um link para ${email}`);
    } catch (err) {
      toast(err instanceof AuthError ? err.message : 'Não foi possível enviar agora. Tente de novo.', 'err');
    }
  };

  const social = async (provider: 'google' | 'apple') => {
    try {
      const previous = useAuth.getState().session;
      const res = await auth.signInWithProvider(provider);
      if (res === 'redirect') return;
      await switchUser(previous, res);
      await finish(res, mode);
    } catch (err) {
      toast(err instanceof AuthError ? err.message : 'Não foi possível entrar agora. Tente de novo.', 'err');
    }
  };

  const skip = async () => {
    if (hasVehicle) return goBack(navigate, '/');
    try {
      if (!session) await auth.signInAnonymously();
      void navigate({ to: '/onboarding', search: { modo: 'primeiro' } });
    } catch (err) {
      toast(err instanceof AuthError ? err.message : 'Sem conexão. Tente de novo quando a rede voltar.', 'err');
    }
  };

  return (
    <div className="fixed inset-0 z-25 flex justify-center bg-page">
      <div className="flex w-full max-w-[480px] flex-col overflow-y-auto bg-white tablet:shadow-side-panel">
        <div className="h-[58px] flex-none px-6 pt-[18px]">
          {canClose ? <BackButton label="Fechar" onClick={() => goBack(navigate, '/')} /> : null}
        </div>

        <div className="flex flex-1 flex-col justify-center gap-7 px-8 pt-3 pb-6">
          <div className="flex flex-col items-center gap-[14px] text-center">
            <img src="/brand/icone.webp" alt="" width={84} height={84} className="block h-[84px] w-[84px]" />
            <div>
              <h1 className="m-0 text-[28px] font-bold tracking-[-0.02em]">
                Quero<span className="text-primary">Revisar</span>
              </h1>
              <div className="mt-1 text-[15px] text-muted">
                {signin ? 'Entre para ver seus veículos e alertas' : 'Crie sua conta e nunca mais esqueça uma troca'}
              </div>
            </div>
          </div>

          <form
            className="flex flex-col gap-2.5"
            onSubmit={e => {
              e.preventDefault();
              void submit();
            }}
          >
            {!signin ? (
              <Input
                variant="filled"
                placeholder="Nome"
                aria-label="Nome"
                autoComplete="given-name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            ) : null}
            <Input
              variant="filled"
              type="email"
              placeholder="E-mail"
              aria-label="E-mail"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value.trim())}
            />
            <div className="relative">
              <Input
                variant="filled"
                type={showPw ? 'text' : 'password'}
                placeholder="Senha"
                aria-label="Senha"
                autoComplete={signin ? 'current-password' : 'new-password'}
                className="pr-[84px]"
                value={pw}
                onChange={e => setPw(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPw(s => !s)}
                className="absolute top-1.5 right-1.5 h-10 border-0 bg-transparent px-3 text-[14px] font-semibold"
              >
                {showPw ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <Button type="submit" block loading={busy} className="mt-1.5">
              {signin ? 'Entrar' : 'Criar conta'}
            </Button>
            {signin ? (
              <button
                type="button"
                onClick={() => void forgot()}
                className="self-center border-0 bg-transparent p-2 text-[14px] font-semibold"
              >
                Esqueceu a senha?
              </button>
            ) : null}
          </form>

          <div className="flex items-center gap-[14px] text-[13px] font-semibold text-subtle">
            <span className="h-px flex-1 bg-border" />
            OU
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="flex flex-col gap-2.5">
            <Button
              variant="outline-neutral"
              block
              className="text-[15px]"
              icon={<GoogleIcon />}
              onClick={() => void social('google')}
            >
              Continuar com Google
            </Button>
            {appleLogin ? (
              <Button
                variant="dark"
                block
                className="text-[15px]"
                icon={<AppleIcon />}
                onClick={() => void social('apple')}
              >
                Continuar com Apple
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-none flex-col items-center gap-1.5 border-t border-border px-6 pt-4 pb-[26px]">
          <button
            type="button"
            onClick={() => setMode(signin ? 'signup' : 'signin')}
            className="border-0 bg-transparent p-1.5 text-[15px]"
          >
            {signin ? 'Não tem conta?' : 'Já tem conta?'}{' '}
            <span className="font-bold text-primary">{signin ? 'Cadastre-se' : 'Entrar'}</span>
          </button>
          <button
            type="button"
            onClick={() => void skip()}
            className="border-0 bg-transparent p-1.5 text-[14px] text-muted underline"
          >
            Continuar sem conta
          </button>
          {!signin ? (
            <div className="mt-1 text-center text-[12px] text-pretty text-muted">
              Ao criar a conta, você aceita os{' '}
              <a href={`${env.landingUrl}/termos`} className="text-ink underline">
                Termos
              </a>{' '}
              e a{' '}
              <a href={`${env.landingUrl}/privacidade`} className="text-ink underline">
                Política de privacidade
              </a>
              .
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
