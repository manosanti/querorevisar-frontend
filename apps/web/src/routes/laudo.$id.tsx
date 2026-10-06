import { createFileRoute, Navigate } from '@tanstack/react-router';
import { Laudo } from '../features/consultas/Laudo.tsx';
import { useAuth } from '../lib/auth/store.ts';

export const Route = createFileRoute('/laudo/$id')({
  component: function LaudoRoute() {
    const { id } = Route.useParams();
    const auth = useAuth();
    if (auth.status === 'loading') return null;
    if (!auth.session) return <Navigate to="/entrar" replace />;
    return <Laudo id={id} />;
  },
});
