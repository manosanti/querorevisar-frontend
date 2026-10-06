import { createFileRoute } from '@tanstack/react-router';
import { ConsultaResult } from '../../features/consultas/ConsultaResult.tsx';

export const Route = createFileRoute('/_app/consultas/$id')({
  component: function ConsultaResultRoute() {
    const { id } = Route.useParams();
    return <ConsultaResult id={id} />;
  },
});
