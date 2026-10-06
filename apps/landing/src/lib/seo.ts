// Shared by astro.config.ts (sitemap filter) and the base layout (robots meta).

export const SITE_NAME = 'QueroRevisar';

/**
 * Pages kept out of search engines. Privacy and terms stay here while their text is a placeholder
 * waiting for the owner (PENDENCIAS.md); remove them from this list when the final text is published.
 */
export const NOINDEX_PATHS: readonly string[] = ['/privacidade', '/termos', '/404'];

export function normalizePath(pathname: string): string {
  const p = pathname.replace(/\.html$/, '').replace(/\/+$/, '');
  return p === '' || p === '/index' ? '/' : p;
}

export function isNoindex(pathname: string): boolean {
  return NOINDEX_PATHS.includes(normalizePath(pathname));
}

export function pageTitle(title: string | undefined): string {
  return title ? `${title} · ${SITE_NAME}` : SITE_NAME;
}
