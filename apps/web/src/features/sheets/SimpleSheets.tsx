// Small sheets of the prototype: km, vehicle management, sold, delete, logout, paywall, parts,
// plus account deletion (LGPD) and the iOS install guide.
import { api } from '@qr/api-client';
import { fmtInt, parseNumber, recordsTxt } from '@qr/core';
import { BigNumberInput, Button, Icon, ICON_PATHS, toast } from '@qr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { archiveVehicle, confirmKm, deleteVehicle, updateKm } from '../../lib/actions.ts';
import { stopAnalytics } from '../../lib/analytics.ts';
import { auth, useAuth } from '../../lib/auth/store.ts';
import { clearQueryCache } from '../../lib/data/query.ts';
import { clearOutbox } from '../../lib/data/sync.ts';
import { useAppModel } from '../../lib/model.ts';
import { closeSheet, openSheet, useUi } from '../../lib/ui-store.ts';
import { goToPremiumCheckout } from '../../lib/billing.ts';

const Title = ({ children }: { children: ReactNode }) => (
  <h2 className="m-0 text-[22px] font-bold tracking-[-0.02em]">{children}</h2>
);
const Text = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`text-[14.5px] text-pretty text-muted ${className}`}>{children}</div>
);
const Cancel = ({ label = 'Cancelar' }: { label?: string }) => (
  <Button variant="ghost" className="w-full" onClick={closeSheet}>
    {label}
  </Button>
);

export function KmSheet() {
  const m = useAppModel();
  const vehicle = m.vehicle!;
  const [draft, setDraft] = useState('');
  const maxRecordKm = m.vehicleRecords.reduce((a, r) => Math.max(a, r.km), 0);
  return (
    <div className="flex flex-col gap-4">
      <Title>Rodou quanto?</Title>
      <Text className="-mt-2">
        Estimamos {fmtInt(m.estKm)} km pela sua média de {fmtInt(vehicle.kmPerMonth)} km por mês.
      </Text>
      <BigNumberInput
        aria-label="Km no painel"
        suffix="km no painel"
        height={56}
        fontSize={24}
        placeholder={fmtInt(m.estKm)}
        value={draft}
        onChange={e => {
          const n = parseNumber(e.target.value);
          setDraft(n === null ? '' : fmtInt(n));
        }}
      />
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          variant="outline"
          onClick={async () => {
            await confirmKm(vehicle);
            closeSheet();
          }}
        >
          Está certo
        </Button>
        <Button
          onClick={async () => {
            if (await updateKm(vehicle, parseNumber(draft), maxRecordKm)) closeSheet();
          }}
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}

function ActionRow({
  icon,
  tone,
  title,
  sub,
  onClick,
  last,
}: {
  icon: readonly string[];
  tone: 'teal' | 'red';
  title: string;
  sub: string;
  onClick: () => void;
  last?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-[14px] border-0 border-t border-border bg-transparent px-1 py-[14px] text-left transition-transform active:scale-98 ${last ? 'border-b' : ''}`}
    >
      <span
        className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${tone === 'teal' ? 'bg-primary-tint text-primary' : 'bg-over-bg text-over-fg'}`}
      >
        <Icon paths={icon} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[16px] font-semibold ${tone === 'red' ? 'text-over-fg' : ''}`}>{title}</span>
        <span className="block text-[13.5px] text-muted">{sub}</span>
      </span>
    </button>
  );
}

export function VehicleSheet() {
  const m = useAppModel();
  const v = m.vehicle!;
  return (
    <div className="flex flex-col gap-1.5">
      <Title>
        {v.brand} {v.model}
      </Title>
      <div className="mb-2 text-[14px] text-muted">
        {v.year} · {recordsTxt(m.vehicleRecords.length)}
      </div>
      <ActionRow
        icon={ICON_PATHS.swap}
        tone="teal"
        title="Vendi ou troquei de veículo"
        sub="Guarda o histórico e cadastra o novo"
        onClick={() => openSheet({ type: 'sold' })}
      />
      <ActionRow
        icon={ICON_PATHS.trash}
        tone="red"
        title="Excluir veículo"
        sub="Para cadastro errado. Apaga os registros."
        onClick={() => openSheet({ type: 'delete' })}
        last
      />
      <Cancel />
    </div>
  );
}

export function SoldSheet() {
  const m = useAppModel();
  const navigate = useNavigate();
  const v = m.vehicle!;
  const others = m.vehicles.filter(x => x.id !== v.id);
  return (
    <div className="flex flex-col gap-3">
      <Title>Trocou de veículo?</Title>
      <Text>
        O {v.model} sai do painel e vai para Conta › Veículos anteriores, com o histórico de manutenção guardado. Dá
        para restaurar depois.
      </Text>
      <Button
        block
        onClick={() => {
          closeSheet();
          void navigate({ to: '/onboarding', search: { modo: 'substituir', substitui: v.id } });
        }}
      >
        Cadastrar o novo veículo
      </Button>
      {others.length ? (
        <Button
          block
          variant="outline-neutral"
          className="text-[15px]!"
          onClick={async () => {
            await archiveVehicle(v.id);
            useUi.getState().setActiveVehicle(others[0]!.id);
            closeSheet();
            toast(`${v.model} guardado em Veículos anteriores`);
          }}
        >
          Só guardar, sem cadastrar outro
        </Button>
      ) : null}
      <Cancel />
    </div>
  );
}

export function DeleteSheet() {
  const m = useAppModel();
  const navigate = useNavigate();
  const v = m.vehicle!;
  return (
    <div className="flex flex-col gap-3">
      <Title>Excluir {v.model}?</Title>
      <Text>
        O veículo e {recordsTxt(m.vehicleRecords.length)} serão apagados. Isso não pode ser desfeito. Se você vendeu o
        veículo, prefira guardar o histórico.
      </Text>
      <Button
        block
        variant="danger"
        onClick={async () => {
          const others = m.vehicles.filter(x => x.id !== v.id);
          await deleteVehicle(v.id);
          useUi.getState().setActiveVehicle(others[0]?.id ?? null);
          closeSheet();
          toast(`${v.model} excluído`);
          if (!others.length) void navigate({ to: '/onboarding', search: { modo: 'primeiro' } });
        }}
      >
        Excluir
      </Button>
      <Button block variant="outline-neutral" className="text-[15px]!" onClick={() => openSheet({ type: 'sold' })}>
        Vendi, quero guardar o histórico
      </Button>
      <Cancel />
    </div>
  );
}

/** Logout and account deletion share the cleanup: local data of this device is wiped. */
async function wipeLocal(navigate: ReturnType<typeof useNavigate>, email: string | null) {
  const userId = useAuth.getState().session?.user.id;
  if (userId) await clearOutbox(userId);
  await auth.signOut();
  await clearQueryCache();
  stopAnalytics();
  useUi.setState({ activeVehicleId: null, sheet: null });
  void navigate({ to: '/entrar', search: { mode: 'signin', ...(email ? { email } : {}) }, replace: true });
}

export function LogoutSheet() {
  const navigate = useNavigate();
  const m = useAppModel();
  return (
    <div className="flex flex-col gap-3">
      <Title>Sair da conta?</Title>
      <Text>
        Seus veículos e registros continuam salvos na conta. Neste aparelho eles serão apagados, e você precisará entrar
        de novo para vê-los.
      </Text>
      <Button
        block
        variant="danger"
        onClick={async () => {
          await wipeLocal(navigate, m.me?.email ?? null);
          toast('Você saiu da conta');
        }}
      >
        Sair
      </Button>
      <Cancel />
    </div>
  );
}

export function DeleteAccountSheet() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Title>Excluir conta?</Title>
      <Text>
        Seus veículos, registros, consultas e créditos serão apagados de vez, neste aparelho e na nuvem. Isso não pode
        ser desfeito.
      </Text>
      <Button
        block
        variant="danger"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api.deleteMe();
            await wipeLocal(navigate, null);
            toast('Conta excluída');
          } catch {
            setBusy(false);
            toast('Não foi possível excluir agora. Tente de novo.', 'err');
          }
        }}
      >
        Excluir conta
      </Button>
      <Cancel />
    </div>
  );
}

export function PaywallSheet({ reason }: { reason: 'veiculo' | 'ads' }) {
  return (
    <div className="flex flex-col gap-3">
      <Title>{reason === 'ads' ? 'Use sem anúncios' : 'Mais de um veículo'}</Title>
      <Text>
        O plano grátis acompanha 1 veículo. Com o Premium você cadastra quantos quiser, vê o histórico completo e usa
        sem anúncio.
      </Text>
      <Button block onClick={() => void goToPremiumCheckout()}>
        Assinar por R$ 14,90/mês
      </Button>
      <Cancel label="Agora não" />
    </div>
  );
}

export function PartsSheet({ itemId }: { itemId: string }) {
  const m = useAppModel();
  const v = m.vehicle!;
  const name = m.items.find(i => i.id === itemId)?.name ?? '';
  const parts = [
    { name: `${name} · linha original`, store: 'Loja parceira A', price: 'R$ 129,90' },
    { name: `${name} · marca alternativa`, store: 'Loja parceira B', price: 'R$ 98,50' },
    { name: `${name} · kit com instalação`, store: 'Loja parceira C', price: 'R$ 189,00' },
  ];
  return (
    <div className="flex flex-col gap-3">
      <Title>Peças compatíveis</Title>
      <div className="-mt-1.5 text-[14px] text-muted">
        {name} · {v.brand} {v.model} {v.year}
      </div>
      {parts.map(p => (
        <div key={p.name} className="flex items-center gap-3 border-b border-border py-3">
          <div className="h-[52px] w-[52px] flex-none rounded-12 bg-surface-2" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">{p.name}</div>
            <div className="text-[13px] text-muted">{p.store}</div>
          </div>
          <div className="text-[15px] font-bold tabular-nums">{p.price}</div>
        </div>
      ))}
      <div className="text-[12.5px] text-subtle">Links de lojas parceiras. O QueroRevisar pode receber comissão.</div>
    </div>
  );
}

/** iOS Safari: alerts only work with the app installed (Arquitetura v2 §5). */
export function InstallSheet() {
  const steps = [
    'Toque em Compartilhar, o quadrado com a seta para cima, na barra do Safari.',
    'Escolha "Adicionar à Tela de Início".',
    'Abra o QueroRevisar pelo ícone novo e ative os alertas em Conta.',
  ];
  return (
    <div className="flex flex-col gap-3">
      <Title>Instale o app no iPhone</Title>
      <Text>No iPhone, os alertas de manutenção só chegam com o app instalado na tela de início.</Text>
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {steps.map((s, i) => (
          <li key={s} className="flex items-start gap-3 text-[15px]">
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary-tint text-[13px] font-bold text-primary">
              {i + 1}
            </span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
      <Cancel label="Entendi" />
    </div>
  );
}
