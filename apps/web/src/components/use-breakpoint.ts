import { breakpoints } from '@qr/tokens';
import { useSyncExternalStore } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const queries = {
  tablet: `(min-width: ${breakpoints.tablet}px)`,
  desktop: `(min-width: ${breakpoints.desktop}px)`,
};

function read(): Breakpoint {
  if (typeof window === 'undefined' || !window.matchMedia) return 'mobile';
  if (window.matchMedia(queries.desktop).matches) return 'desktop';
  if (window.matchMedia(queries.tablet).matches) return 'tablet';
  return 'mobile';
}

function subscribe(cb: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const lists = [window.matchMedia(queries.tablet), window.matchMedia(queries.desktop)];
  for (const l of lists) l.addEventListener('change', cb);
  return () => {
    for (const l of lists) l.removeEventListener('change', cb);
  };
}

/** mobile < 768 ≤ tablet < 1100 ≤ desktop (docs/screens.md#shell). */
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, read, () => 'mobile');
}
