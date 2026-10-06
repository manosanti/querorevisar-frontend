// Conta (docs/screens.md#conta) + LGPD export/delete (F12.4), alerts (F08) and install (F07.3).
import { api } from '@qr/api-client';
import { dateBR, recordsTxt } from '@qr/core';
import {
  AdSlot,
  Avatar,
  Button,
  Card,
  IconButton,
  DotsIcon,
  PlusIcon,
  SectionTitle,
  ScreenTitle,
  ToneBadge,
  VehicleImage,
  toast,
  cn,
} from '@qr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { env } from '../../env.ts';
import { restoreVehicle } from '../../lib/actions.ts';
import { useAds } from '../../lib/ads.ts';
import { track } from '../../lib/analytics.ts';
import { useAuth } from '../../lib/auth/store.ts';
import { refreshState } from '../../lib/data/sync.ts';
import { goToPremiumCheckout } from '../../lib/billing.ts';
import { useAppModel } from '../../lib/model.ts';
import { addVehicleOrPaywall } from '../../lib/navigation.ts';
import { enablePush, pushAvailability, type PushAvailability } from '../../lib/push.ts';
import { needsIosInstallGuide, promptInstall, usePwa } from '../../lib/pwa.ts';
import { openSheet, useUi } from '../../lib/ui-store.ts';

const soldAt = (iso: string | null) =>
  new Date(iso ?? Date.now())
    .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    .replace('.', '')
    .replace(' de ', '/');

function AlertsRow() {
  const [state, setState] = useState<PushAvailability | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void pushAvailability().then(setState);
  }, []);
  if (!state || state === 'unsupported' || !env.vapidPublicKey) return null;
  return (
    <div className="flex items-center gap-3 border-b border-border py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[15.5px] font-semibold">Alertas no celular</div>
        <div className="text-[13px] text-muted">
          {state === 'enabled'
            ? 'Ativados. Avisamos quando um item estiver perto de vencer.'
            : state === 'denied'
              ? 'Bloqueados nas configurações do navegador.'
              : state === 'needs-install'
                ? 'No iPhone, instale o app para receber alertas.'
                : 'Receba um aviso quando um item estiver perto de vencer.'}
        </div>
      </div>
      {state === 'available' ? (
        <Button
          size="sm"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await enablePush().catch(() => false);
            setBusy(false);
            setState(ok ? 'enabled' : await pushAvailability());
            if (ok) toast('Alertas ativados');
          }}
        >
          Ativar
        </Button>
      ) : state === 'needs-install' ? (
        <Button size="sm" variant="outline" onClick={() => openSheet({ type: 'install' })}>
          Como instalar
        </Button>
      ) : null}
    </div>
  );
}

function InstallRow() {
  const installEvent = usePwa(s => s.installEvent);
  if (!installEvent && !needsIosInstallGuide()) return null;
  return (
    <div className="flex items-center gap-3 border-b border-border py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[15.5px] font-semibold">Instalar o app</div>
        <div className="text-[13px] text-muted">Abra o QueroRevisar direto da tela de início, mesmo sem internet.</div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => (installEvent ? void promptInstall() : openSheet({ type: 'install' }))}
      >
        Instalar
      </Button>
    </div>
  );
}

export function Conta() {
  const m = useAppModel();
  const navigate = useNavigate();
  const session = useAuth(s => s.session);
  const setActive = useUi(s => s.setActiveVehicle);
  const ads = useAds();
  const [exporting, setExporting] = useState(false);
  const isFree = m.plan === 'free';
  const name = m.me?.name ?? session?.user.name ?? (m.me?.email ? m.me.email.split('@')[0]! : 'Conta');
  const email = m.me?.email ?? session?.user.email ?? '';

  const download = async () => {
    setExporting(true);
    try {
      const data = await api.exportMe();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'querorevisar-meus-dados.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('Não foi possível exportar agora. Tente de novo.', 'err');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-[18px] px-[22px] pt-[22px] pb-6">
      <ScreenTitle>Conta</ScreenTitle>
      {m.isAnonymous ? (
        <Card className="flex flex-col gap-2.5">
          <div className="text-[17px] font-semibold">Você está usando sem conta</div>
          <div className="text-[14px] text-muted">
            Os registros ficam só neste aparelho. Crie uma conta para salvar e receber alertas.
          </div>
          <Button block onClick={() => void navigate({ to: '/entrar', search: { mode: 'signup' } })}>
            Criar conta
          </Button>
        </Card>
      ) : (
        <div className="flex items-center gap-[14px]">
          <Avatar letter={name.charAt(0).toUpperCase()} size={52} />
          <div className="min-w-0">
            <div className="text-[17px] font-semibold">{name}</div>
            <div className="text-[14px] text-muted">
              {email} · Plano {isFree ? 'Grátis' : 'Premium'}
            </div>
          </div>
          <Button
            variant="danger-text"
            className="ml-auto h-auto! px-0! py-2 text-[14px]"
            onClick={() => openSheet({ type: 'logout' })}
          >
            Sair
          </Button>
        </div>
      )}

      <section aria-labelledby="veiculos-title">
        <SectionTitle id="veiculos-title" className="mb-1.5">
          Veículos
        </SectionTitle>
        {m.vehicles.map(v => {
          const active = v.id === m.vehicle?.id;
          return (
            <div key={v.id} className="flex items-center gap-3 border-b border-border py-3">
              <VehicleImage type={v.type} size={52} />
              <div className="min-w-0 flex-1">
                <div className="text-[15.5px] font-semibold">{v.model}</div>
                <div className="text-[13px] text-muted">
                  {v.brand} · {v.year}
                </div>
              </div>
              {active ? (
                <ToneBadge tone="ok" size="sm">
                  Ativo
                </ToneBadge>
              ) : (
                <button
                  type="button"
                  onClick={() => setActive(v.id)}
                  className="border-0 bg-transparent text-[14px] font-semibold underline"
                >
                  Ver
                </button>
              )}
              <IconButton
                label="Gerenciar veículo"
                className="rounded-full border-0 bg-transparent text-ink"
                onClick={() => {
                  if (!active) setActive(v.id);
                  openSheet({ type: 'vehicle' });
                }}
              >
                <DotsIcon />
              </IconButton>
            </div>
          );
        })}
        <Button block className="mt-3" icon={<PlusIcon />} onClick={() => addVehicleOrPaywall(m, navigate)}>
          Adicionar veículo
        </Button>
      </section>

      {m.archived.length ? (
        <section aria-labelledby="anteriores-title">
          <SectionTitle id="anteriores-title">Veículos anteriores</SectionTitle>
          <div className="mt-0.5 mb-1.5 text-[13.5px] text-muted">
            Vendidos ou trocados. O histórico de manutenção continua guardado.
          </div>
          {m.archived.map(v => {
            const count = m.records.filter(r => r.vehicleId === v.id).length;
            return (
              <div key={v.id} className="flex items-center gap-3 border-b border-border py-3">
                <VehicleImage type={v.type} size={52} muted />
                <div className="min-w-0 flex-1">
                  <div className="text-[15.5px] font-semibold">{v.model}</div>
                  <div className="text-[13px] text-muted">
                    {v.brand} · {v.year} · {recordsTxt(count)} · saiu em {soldAt(v.archivedAt)}
                  </div>
                </div>
                <button
                  type="button"
                  className="border-0 bg-transparent text-[14px] font-semibold underline"
                  onClick={async () => {
                    if (isFree) {
                      track('paywall_viewed', { reason: 'veiculo' });
                      openSheet({ type: 'paywall', reason: 'veiculo' });
                      return;
                    }
                    await restoreVehicle(v.id);
                    toast(`${v.model} restaurado`);
                  }}
                >
                  Restaurar
                </button>
              </div>
            );
          })}
        </section>
      ) : null}

      {(m.me?.flags.vehicleLookups ?? true) ? (
        <section aria-labelledby="consultas-title">
          <SectionTitle id="consultas-title" className="mb-2.5">
            Consultas veiculares
          </SectionTitle>
          <div className="flex items-center gap-3 rounded-18 border border-border p-4">
            <div className="min-w-0 flex-1">
              <div className="text-[24px] font-bold tracking-[-0.02em] tabular-nums">{m.creditsLabel}</div>
              <div className="text-[13.5px] text-muted">
                {isFree
                  ? 'Avulso ou em pacote. No Premium, 2 créditos por mês.'
                  : 'Inclui 2 créditos por mês do Premium.'}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => openSheet({ type: 'credits' })}>
              Comprar
            </Button>
            <Button size="sm" onClick={() => void navigate({ to: '/consultas', search: { modo: 'outro' } })}>
              Consultar
            </Button>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="planos-title">
        <SectionTitle id="planos-title" className="mb-2.5">
          Planos
        </SectionTitle>
        <div className="flex flex-col gap-2.5">
          <div className={cn('rounded-18 p-4', isFree ? 'border-2 border-primary' : 'border border-border')}>
            <div className="flex items-baseline justify-between">
              <div className="text-[17px] font-bold">Grátis</div>
              <div className="text-[17px] font-bold">R$ 0</div>
            </div>
            <div className="mt-1 text-[14px] text-muted">
              1 veículo · todos os alertas · histórico de 12 meses · com anúncio
            </div>
          </div>
          <div
            className={cn(
              'flex flex-col gap-2.5 rounded-18 p-4',
              !isFree ? 'border-2 border-primary' : 'border border-border',
            )}
          >
            <div className="flex items-baseline justify-between">
              <div className="text-[17px] font-bold">Premium</div>
              <div className="text-[17px] font-bold tabular-nums">
                R$ 14,90<span className="text-[13px] font-medium text-muted">/mês</span>
              </div>
            </div>
            <div className="text-[14px] text-muted">
              Vários veículos · histórico completo e PDF · sem anúncio · cadastro por placa · 2 créditos de consulta por
              mês
            </div>
            {isFree ? (
              <Button block onClick={() => void goToPremiumCheckout()}>
                Assinar Premium
              </Button>
            ) : (
              <Button
                variant="outline-neutral"
                size="md"
                className="font-medium! text-[14px]!"
                onClick={async () => {
                  try {
                    const res = await api.cancelPremium();
                    await refreshState();
                    toast(
                      res.premiumUntil
                        ? `Assinatura cancelada. O Premium continua até ${dateBR(res.premiumUntil.slice(0, 10))}.`
                        : 'Assinatura cancelada.',
                    );
                  } catch {
                    toast('Não foi possível cancelar agora. Tente de novo.', 'err');
                  }
                }}
              >
                Seu plano atual · voltar ao grátis
              </Button>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Aplicativo e dados">
        <AlertsRow />
        <InstallRow />
        <div className="flex items-center gap-3 border-b border-border py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[15.5px] font-semibold">Seus dados</div>
            <div className="text-[13px] text-muted">Baixe uma cópia de tudo ou exclua a conta.</div>
          </div>
          <Button size="sm" variant="outline-neutral" loading={exporting} onClick={() => void download()}>
            Exportar
          </Button>
        </div>
        <Button
          variant="danger-text"
          className="mt-1 text-[14px]"
          onClick={() => openSheet({ type: 'delete-account' })}
        >
          Excluir conta
        </Button>
      </section>

      {ads.show ? (
        <AdSlot
          slot="conta-rodape"
          size="rectangle"
          mode={env.adsMode}
          adsenseClient={env.adsenseClient ?? undefined}
          adsenseSlot={env.adsenseSlots.conta ?? undefined}
          onRemoveAds={ads.onRemove}
        />
      ) : null}
    </div>
  );
}
