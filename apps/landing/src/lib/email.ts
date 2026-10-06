// E-mail check used by the sign-up forms (same rule as the prototype's submitWith).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const EMAIL_ERROR = 'Digite um e-mail válido, ex.: nome@gmail.com';

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
