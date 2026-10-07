import { Button, EmptyState, ToastViewport } from '@qr/ui';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet, useNavigate } from '@tanstack/react-router';
import { ConsentBanner, OfflineIndicator, UpdatePrompt } from '../components/GlobalBanners.tsx';
import { lazy, Suspense } from 'react';
import { useUi } from '../lib/ui-store.ts';

const loadSheets = () => import('../features/sheets/SheetsHost.tsx');
const SheetsHost = lazy(() => loadSheets().then(m => ({ default: m.SheetsHost })));

// Fetch the sheets chunk once the app is idle, so "Registrar troca" also opens offline before the
// service worker has precached it (first visit, dev server).
if (typeof window !== 'undefined') {
  const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
  idle(() => void loadSheets().catch(() => {}));
}

/** Sheets are only downloaded when one opens (keeps them out of the first load). */
function LazySheets() {
  const open = useUi(s => !!s.sheet);
  return open ? (
    <Suspense fallback={null}>
      <SheetsHost />
    </Suspense>
  ) : null;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});

function Root() {
  return (
    <>
      <Outlet />
      <LazySheets />
      <ToastViewport />
      <OfflineIndicator />
      <UpdatePrompt />
      <ConsentBanner />
    </>
  );
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6">
      <EmptyState>Página não encontrada.</EmptyState>
      <Button onClick={() => void navigate({ to: '/' })}>Voltar ao painel</Button>
    </div>
  );
}

/** Error boundary per screen, with retry (Arquitetura v2 §8). */
function RouteError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <EmptyState>Algo deu errado ao abrir esta tela.</EmptyState>
      <Button onClick={reset}>Tentar de novo</Button>
    </div>
  );
}
