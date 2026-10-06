// Item detail: full screen on mobile, 480px right panel with the list behind from 768px.
import { fmtInt, intervalText, money, STATUS_LABEL, timeText } from '@qr/core';
import { BackButton, Button, SidePanel, StatusBadge, cn } from '@qr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useAppModel } from '../../lib/model.ts';
import { goBack } from '../../lib/navigation.ts';
import { openSheet } from '../../lib/ui-store.ts';

const BAR: Record<string, string> = { over: 'bg-over-bar', warn: 'bg-warn-bar', ok: 'bg-primary', none: 'bg-border' };

export function ItemDetail({ itemId }: { itemId: string }) {
  const m = useAppModel();
  const navigate = useNavigate();
  const close = () => goBack(navigate, '/itens');
  const row = m.rows.find(r => r.item.id === itemId);
  if (!row) {
    return (
      <SidePanel open label="Item" onClose={close}>
        <div className="flex flex-col gap-5 px-[22px] pt-[18px]">
          <BackButton onClick={close} />
          <div className="text-muted">Item não encontrado para este veículo.</div>
        </div>
      </SidePanel>
    );
  }
  const { item, status: s } = row;
  const r = s.record;
  const showParts = (m.me?.flags.partsMarketplace ?? false) && !item.insp && s.key !== 'ok';

  let big = '';
  let bigSub = '';
  if (r) {
    if (s.key === 'over' && s.byTime) {
      big = `${Math.round(s.monthsUsed ?? 0)} meses`;
      bigSub = `limite de ${item.months} meses`;
    } else if (s.kmLeft !== null) {
      big = s.kmLeft >= 0 ? `~${fmtInt(s.kmLeft)} km` : `${fmtInt(-s.kmLeft)} km acima`;
      bigSub =
        s.key === 'over'
          ? 'vencido'
          : s.byTime && s.monthsLeft !== null
            ? `ou ~${Math.max(1, Math.round(s.monthsLeft))} meses`
            : timeText(s.kmLeft, m.vehicle?.kmPerMonth ?? 1);
    } else {
      big = s.monthsLeft !== null ? `~${Math.max(1, Math.round(s.monthsLeft))} meses` : '—';
      bigSub = s.key === 'over' ? 'vencido' : 'pelo tempo';
    }
  }
  const recordFull = r ? m.vehicleRecords.find(x => x.itemId === item.id && x.km === r.km) : null;
  const lastLine = recordFull
    ? [
        recordFull.where === 'shop' ? 'No mecânico' : 'Em casa',
        recordFull.costCents ? money(recordFull.costCents) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <SidePanel open label={item.name} onClose={close}>
      <div className="flex flex-1 flex-col gap-5 px-[22px] pt-[18px]">
        <BackButton onClick={close} />
        <div>
          <StatusBadge status={s.key} filledNone>
            {STATUS_LABEL[s.key]}
          </StatusBadge>
          <h1 className="m-0 mt-2.5 text-[28px] leading-[1.15] font-bold tracking-[-0.02em]">{item.name}</h1>
          <div className="mt-1 text-[15px] text-muted">{item.desc}</div>
        </div>

        {r ? (
          <div className="rounded-20 border border-border p-[18px] shadow-dropdown">
            <div className="flex items-baseline justify-between gap-2.5">
              <div className="text-[28px] font-bold tracking-[-0.03em] tabular-nums">{big}</div>
              <div className="text-right text-[14px] text-muted">{bigSub}</div>
            </div>
            <div className="mt-[14px] mb-2.5 h-1.5 rounded-[6px] bg-track">
              <div className={cn('h-full rounded-[6px]', BAR[s.key])} style={{ width: `${row.barPct}%` }} />
            </div>
            <div className="flex justify-between gap-2.5 text-[13px] text-muted tabular-nums">
              <span>Trocado em {fmtInt(r.km)} km</span>
              <span>Vence em {s.dueKm ? fmtInt(s.dueKm) : '—'} km</span>
            </div>
          </div>
        ) : (
          <div className="rounded-20 bg-surface-2 p-[18px] text-[14.5px] text-ink-2">
            Ainda sem registro. Informe o km da última troca e o app passa a acompanhar.
          </div>
        )}

        <div className="flex flex-col">
          <div className="flex justify-between gap-3 border-b border-border py-3 text-[15px]">
            <span className="text-muted">Intervalo</span>
            <span className="text-right font-semibold">{intervalText(item)}</span>
          </div>
          <div className="flex justify-between gap-3 border-b border-border py-3 text-[15px]">
            <span className="text-muted">Fonte</span>
            <span className="text-right font-semibold">{item.source}</span>
          </div>
          {r ? (
            <div className="flex justify-between gap-3 py-3 text-[15px]">
              <span className="text-muted">Última troca</span>
              <span className="text-right font-semibold">{lastLine}</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-none flex-col gap-2.5 px-[22px] pt-5 pb-[30px]">
        <Button
          block
          onClick={() => {
            close();
            openSheet({ type: 'register', itemId: item.id });
          }}
        >
          Registrar troca
        </Button>
        {showParts ? (
          <Button block variant="outline" onClick={() => openSheet({ type: 'parts', itemId: item.id })}>
            Ver peças compatíveis
          </Button>
        ) : null}
      </div>
    </SidePanel>
  );
}
