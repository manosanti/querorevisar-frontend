// Consultas: right panel (≥768) over the last tab, full screen on mobile.
import { SidePanel } from '@qr/ui';
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { BackgroundTab } from '../../components/TabRoute.tsx';
import { goBack } from '../../lib/navigation.ts';

export const Route = createFileRoute('/_app/consultas')({
  validateSearch: (s: Record<string, unknown>): { modo?: 'outro' | 'meu' } =>
    s.modo === 'meu' || s.modo === 'outro' ? { modo: s.modo } : {},
  component: ConsultasLayout,
});

function ConsultasLayout() {
  const navigate = useNavigate();
  return (
    <>
      <BackgroundTab />
      <SidePanel open label="Consultas" onClose={() => goBack(navigate, '/')}>
        <Outlet />
      </SidePanel>
    </>
  );
}
