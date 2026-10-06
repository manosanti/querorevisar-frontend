import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ConsultaForm } from '../../features/consultas/ConsultaForm.tsx';
import { goBack } from '../../lib/navigation.ts';

export const Route = createFileRoute('/_app/consultas/')({
  component: function ConsultaFormRoute() {
    const { modo } = Route.useSearch();
    const navigate = useNavigate();
    return (
      <ConsultaForm
        key={modo ?? 'outro'}
        initialMode={modo === 'meu' ? 'mine' : 'other'}
        onClose={() => goBack(navigate, '/')}
      />
    );
  },
});
