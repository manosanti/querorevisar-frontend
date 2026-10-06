export interface AuthUser {
  id: string;
  isAnonymous: boolean;
  email: string | null;
  name: string | null;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
}

export type OAuthProvider = 'google' | 'apple';

/** Same surface for Supabase Auth and the API's local dev auth (AUTH_MODE=dev). */
export interface AuthAdapter {
  readonly kind: 'supabase' | 'dev';
  getSession(): Promise<AuthSession | null>;
  /** Fresh access token (Supabase refreshes it transparently). */
  getAccessToken(): Promise<string | null>;
  onChange(cb: (session: AuthSession | null) => void): () => void;
  signInAnonymously(): Promise<AuthSession>;
  /** Creates the account; when the current user is anonymous the identity is linked to the same user id. */
  signUp(input: SignUpInput): Promise<AuthSession>;
  signIn(input: SignInInput): Promise<AuthSession>;
  /** Returns 'redirect' when the browser is leaving for the provider. */
  signInWithProvider(provider: OAuthProvider): Promise<AuthSession | 'redirect'>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
}

/** Auth error with a pt-BR message that can be shown in a toast. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
