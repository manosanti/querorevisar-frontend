// Renders the sheet currently open in the UI store (bottom sheet <768px, right panel from 768px).
import { Sheet } from '@qr/ui';
import { useAppModel } from '../../lib/model.ts';
import { closeSheet, useUi, type SheetState } from '../../lib/ui-store.ts';
import { CreditsSheet } from './CreditsSheet.tsx';
import { RegisterSheet } from './RegisterSheet.tsx';
import {
  DeleteAccountSheet,
  DeleteSheet,
  InstallSheet,
  KmSheet,
  LogoutSheet,
  PartsSheet,
  PaywallSheet,
  SoldSheet,
  VehicleSheet,
} from './SimpleSheets.tsx';

const LABELS: Record<SheetState['type'], string> = {
  register: 'Registrar troca',
  km: 'Atualizar km',
  vehicle: 'Gerenciar veículo',
  sold: 'Trocou de veículo?',
  delete: 'Excluir veículo',
  paywall: 'Premium',
  logout: 'Sair da conta?',
  parts: 'Peças compatíveis',
  credits: 'Comprar créditos',
  'delete-account': 'Excluir conta?',
  install: 'Instale o app',
};

const NEEDS_VEHICLE = new Set<SheetState['type']>(['register', 'km', 'vehicle', 'sold', 'delete', 'parts']);

function Content({ sheet }: { sheet: SheetState }) {
  switch (sheet.type) {
    case 'register':
      return <RegisterSheet itemId={sheet.itemId} />;
    case 'km':
      return <KmSheet />;
    case 'vehicle':
      return <VehicleSheet />;
    case 'sold':
      return <SoldSheet />;
    case 'delete':
      return <DeleteSheet />;
    case 'paywall':
      return <PaywallSheet reason={sheet.reason} />;
    case 'logout':
      return <LogoutSheet />;
    case 'parts':
      return <PartsSheet itemId={sheet.itemId} />;
    case 'credits':
      return <CreditsSheet need={sheet.need} />;
    case 'delete-account':
      return <DeleteAccountSheet />;
    case 'install':
      return <InstallSheet />;
  }
}

export function SheetsHost() {
  const sheet = useUi(s => s.sheet);
  const m = useAppModel();
  if (!sheet) return null;
  if (NEEDS_VEHICLE.has(sheet.type) && !m.vehicle) return null;
  return (
    <Sheet open label={LABELS[sheet.type]} onClose={closeSheet}>
      <Content key={JSON.stringify(sheet)} sheet={sheet} />
    </Sheet>
  );
}
