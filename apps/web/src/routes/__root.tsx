import { Button, EmptyState, ToastViewport } from '@qr/ui';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet, useNavigate } from '@tanstack/react-router';
import { ConsentBanner, OfflineIndicator, UpdatePrompt } from '../components/GlobalBanners.tsx';
import { SheetsHost } from '../features/sheets/SheetsHost.tsx';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
});

function Root() {
  return (
    <>
      <Outlet />
      <SheetsHost />
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
