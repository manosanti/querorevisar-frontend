// Links from the landing into the web app (apps/web, PUBLIC_APP_URL).
//
// Hand-off contract with apps/web (route /entrar, see docs/PLAN.json F06):
// - `mode=signup` opens the create-account variant of the login screen.
// - `provider=google|apple` starts that OAuth provider right away.
// - `plan=premium` tells the app the visitor came from the Premium card.
// - The e-mail typed on the landing travels in the URL fragment (`#email=`), never in the query string,
//   so it does not reach server logs or the Referer header. The app must read it and clear it with
//   history.replaceState before analytics starts (no PII in PostHog).

export type SignInProvider = 'google' | 'apple';

export interface SignInOptions {
  signup?: boolean;
  provider?: SignInProvider;
  plan?: 'premium';
  email?: string;
}

export const SIGN_IN_PATH = '/entrar';

/** Joins `path` to `base` keeping any sub-path of the base URL. */
export function appUrl(base: string, path = '/'): URL {
  const root = base.endsWith('/') ? base : `${base}/`;
  return new URL(path.replace(/^\/+/, ''), root);
}

export function signInUrl(base: string, opts: SignInOptions = {}): string {
  const url = appUrl(base, SIGN_IN_PATH);
  if (opts.signup) url.searchParams.set('mode', 'signup');
  if (opts.provider) url.searchParams.set('provider', opts.provider);
  if (opts.plan) url.searchParams.set('plan', opts.plan);
  const email = opts.email?.trim();
  if (email) url.hash = new URLSearchParams({ email }).toString();
  return url.href;
}
