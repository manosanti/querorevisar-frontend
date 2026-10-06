import './styles.css';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startAnalytics } from './lib/analytics.ts';
import { initAuth, useAuth } from './lib/auth/store.ts';
import { persistOptions, queryClient } from './lib/data/query.ts';
import { startSyncLoop } from './lib/data/sync.ts';
import { startPwa } from './lib/pwa.ts';
import { startSentry } from './lib/sentry.ts';
import { useUi } from './lib/ui-store.ts';
import { routeTree } from './routeTree.gen.ts';

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

void initAuth().then(() => {
  startSyncLoop();
  if (useUi.getState().consent === 'granted') void startAnalytics(useAuth.getState().session?.user.id ?? null);
});
void startPwa();
void startSentry();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  </StrictMode>,
);
