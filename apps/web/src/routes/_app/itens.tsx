import { createFileRoute, Outlet } from '@tanstack/react-router';
import { TabRoute } from '../../components/TabRoute.tsx';
import { Itens } from '../../features/itens/Itens.tsx';

export const Route = createFileRoute('/_app/itens')({
  component: () => (
    <TabRoute tab="itens">
      <Itens />
      <Outlet />
    </TabRoute>
  ),
});
