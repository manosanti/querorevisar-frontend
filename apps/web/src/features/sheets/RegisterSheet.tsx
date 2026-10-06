// "Registrar troca" sheet (prototype sheetRegister): item search, km, optional date/cost/brand/where.
import { fmtInt, intervalText, KEY_ITEMS, normalizeText, parseMoneyToCents, parseNumber } from '@qr/core';
import { BigNumberInput, Button, DatePicker, InlineLabelInput, Input, SheetTitle, cn } from '@qr/ui';
import { useMemo, useState } from 'react';
import { kmHint, saveRecord } from '../../lib/actions.ts';
import { useAppModel } from '../../lib/model.ts';
import { closeSheet } from '../../lib/ui-store.ts';

export function RegisterSheet({ itemId: initialItem }: { itemId?: string | null | undefined }) {
  const m = useAppModel();
  const vehicle = m.vehicle!;
  const [itemId, setItemId] = useState<string | null>(initialItem ?? null);
  const [q, setQ] = useState('');
  const [km, setKm] = useState('');
  const [date, setDate] = useState('');
  const [cost, setCost] = useState('');
  const [brand, setBrand] = useState('');
  const [where, setWhere] = useState<'home' | 'shop'>('home');
  const [saving, setSaving] = useState(false);

  const item = m.items.find(i => i.id === itemId) ?? null;
  const kmValue = parseNumber(km);
  const matches = useMemo(() => {
    if (item) return [];
    const nq = normalizeText(q);
    const keys = new Set<string>(KEY_ITEMS);
    return m.items.filter(i => (!nq ? keys.has(i.name) : normalizeText(i.name).includes(nq))).slice(0, 6);
  }, [m.items, q, item]);
  const invalid = !item || kmValue === null;

  const save = async () => {
    setSaving(true);
    const ok = await saveRecord(vehicle.id, {
      itemId,
      km: kmValue,
      date,
      costCents: parseMoneyToCents(cost),
      brand,
      where,
    });
    setSaving(false);
    if (ok) closeSheet();
  };

  const wherePill = (value: 'home' | 'shop', label: string) => (
    <button
      type="button"
      aria-pressed={where === value}
      onClick={() => setWhere(value)}
      className={cn(
        'rounded-20 border bg-white px-[14px] py-2 text-[14px] transition-transform active:scale-96',
        where === value ? 'border-primary' : 'border-border',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <SheetTitle
        title="Registrar troca"
        subtitle={`${vehicle.brand} ${vehicle.model}`}
        action={
          <Button variant="ghost" className="text-[15px]" onClick={closeSheet}>
            Cancelar
          </Button>
        }
      />

      <div className="flex flex-col gap-1.5">
        <div className="text-[13.5px] font-semibold">Item</div>
        {item ? (
          <div className="flex items-center justify-between gap-2.5 rounded-12 border border-border px-4 py-[13px]">
            <div className="min-w-0">
              <div className="text-[16px] font-semibold">{item.name}</div>
              <div className="text-[13px] text-muted">
                {item.categoryName} · a cada {intervalText(item)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setItemId(null)}
              className="border-0 bg-transparent text-[14px] text-muted underline transition-transform active:scale-96"
            >
              Trocar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Input
              className="h-12"
              aria-label="Buscar item"
              placeholder="Buscar: óleo, pastilha, filtro…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            {matches.map(i => (
              <button
                key={i.id}
                type="button"
                onClick={() => setItemId(i.id)}
                className="flex justify-between gap-2.5 border-0 border-b border-border bg-transparent px-1 py-[11px] text-left transition-transform active:scale-96"
              >
                <span className="text-[15px]">{i.name}</span>
                <span className="text-[13px] text-subtle">{i.categoryName}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold">Km quando trocou</span>
        <BigNumberInput
          suffix="km"
          placeholder={fmtInt(m.estKm)}
          value={km}
          onChange={e => {
            const n = parseNumber(e.target.value);
            setKm(n === null ? '' : fmtInt(n));
          }}
        />
        <span className="text-[13px] text-muted">{kmHint(kmValue, m.estKm)}</span>
      </label>

      <div className="flex flex-col gap-2.5 border-t border-border pt-[14px]">
        <div className="text-[13.5px] font-semibold text-muted">Opcional</div>
        <DatePicker
          label="Data da troca"
          placeholder="Não lembro"
          clearLabel="Não lembro"
          max="today"
          value={date}
          onChange={setDate}
        />
        <InlineLabelInput
          label="Custo (R$)"
          inputMode="decimal"
          placeholder="0,00"
          value={cost}
          onChange={e => setCost(e.target.value.replace(/[^\d,]/g, ''))}
        />
        <InlineLabelInput
          label="Marca da peça"
          placeholder="Ex.: Mobil, Cobreq"
          maxLength={80}
          value={brand}
          onChange={e => setBrand(e.target.value)}
        />
        <div className="flex gap-2">
          {wherePill('home', 'Fiz em casa')}
          {wherePill('shop', 'No mecânico')}
        </div>
      </div>

      <Button block loading={saving} style={{ opacity: invalid ? 0.4 : 1 }} onClick={() => void save()}>
        Salvar
      </Button>
    </div>
  );
}
