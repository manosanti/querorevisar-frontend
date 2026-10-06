import { createFileRoute } from '@tanstack/react-router';
import { ItemDetail } from '../../features/itens/ItemDetail.tsx';

export const Route = createFileRoute('/_app/itens/$itemId')({
  component: function ItemRoute() {
    const { itemId } = Route.useParams();
    return <ItemDetail itemId={itemId} />;
  },
});
