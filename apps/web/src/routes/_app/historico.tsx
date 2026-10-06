import { createFileRoute } from '@tanstack/react-router';
import { TabRoute } from '../../components/TabRoute.tsx';
import { Historico } from '../../features/historico/Historico.tsx';

export const Route = createFileRoute('/_app/historico')({
  component: () => (
    <TabRoute tab="historico">
      <Historico />
    </TabRoute>
  ),
});
