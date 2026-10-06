import { createFileRoute } from '@tanstack/react-router';
import { TabRoute } from '../../components/TabRoute.tsx';
import { Painel } from '../../features/painel/Painel.tsx';

export const Route = createFileRoute('/_app/')({
  component: () => (
    <TabRoute tab="painel">
      <Painel />
    </TabRoute>
  ),
});
