// "Qual é o seu veículo?" (docs/screens.md#onboarding). Brands/models/years come from FIPE through the API;
// when FIPE is unavailable the prototype's local list is used and the FIPE codes stay empty.
import { api, type FipeOption } from '@qr/api-client';
import {
  FALLBACK_BRANDS,
  findPlan,
  fipeDisplayBrand,
  fipeDisplayModel,
  fmtInt,
  parseNumber,
  type VehicleType,
} from '@qr/core';
import { BackButton, Button, Field, Input, Notice, Select, VehicleImage, toast, cn } from '@qr/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { createVehicle } from '../../lib/actions.ts';
import { track } from '../../lib/analytics.ts';
import { useCatalog } from '../../lib/data/catalog.ts';
import { qk } from '../../lib/data/query.ts';
import { useAppModel } from '../../lib/model.ts';
import { goBack } from '../../lib/navigation.ts';
import { needsIosInstallGuide } from '../../lib/pwa.ts';
import { openSheet, useUi } from '../../lib/ui-store.ts';

interface Picked {
  code: string | null;
  name: string;
}

const LOCAL = (name: string): Picked => ({ code: null, name });
const fallbackYears = () => Array.from({ length: 37 }, (_, i) => String(new Date().getFullYear() + 1 - i));

/** "2019 Gasolina" → 2019; FIPE's "32000" (zero km) → current year. */
export function yearFromFipe(name: string): number | null {
  const m = /^(\d{4,5})/.exec(name.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n === 32000 ? new Date().getFullYear() : n;
}

function useFipeList<T>(key: readonly unknown[], fn: () => Promise<T>, enabled: boolean) {
  return useQuery({ queryKey: key, queryFn: fn, enabled, staleTime: 30 * 24 * 60 * 60 * 1000, retry: 1 });
}

export function Onboarding({ mode, replaceId }: { mode: 'primeiro' | 'adicionar' | 'substituir'; replaceId?: string }) {
  const navigate = useNavigate();
  const m = useAppModel();
  const { data: catalogFile } = useCatalog();
  const setActive = useUi(s => s.setActiveVehicle);
  const replacing = mode === 'substituir' ? (m.vehicles.find(v => v.id === replaceId) ?? null) : null;

  const [type, setType] = useState<VehicleType>('car');
  const [brand, setBrand] = useState<Picked | null>(null);
  const [model, setModel] = useState<Picked | null>(null);
  const [year, setYear] = useState<Picked | null>(null);
  const [km, setKm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => track('onboarding_started', { mode }), [mode]);

  const brands = useFipeList(qk.fipeBrands(type), () => api.listFipeBrands(type), true);
  const local = brands.isError;
  const models = useFipeList(
    qk.fipeModels(type, brand?.code ?? ''),
    () => api.listFipeModels(type, brand!.code!),
    !local && !!brand?.code,
  );
  const years = useFipeList(
    qk.fipeYears(type, brand?.code ?? '', model?.code ?? ''),
    () => api.listFipeYears(type, brand!.code!, model!.code!),
    !local && !!brand?.code && !!model?.code,
  );

  const toOptions = (list: FipeOption[] | undefined) => (list ?? []).map(o => ({ value: o.code, label: o.name }));
  const brandOptions = local
    ? Object.keys(FALLBACK_BRANDS[type])
        .sort()
        .map(n => ({ value: n, label: n }))
    : toOptions(brands.data);
  const modelOptions = local
    ? (FALLBACK_BRANDS[type][brand?.name ?? ''] ?? []).map(n => ({ value: n, label: n }))
    : toOptions(models.data);
  const yearOptions =
    local || years.isError || !model?.code ? fallbackYears().map(y => ({ value: y, label: y })) : toOptions(years.data);

  const kmValue = parseNumber(km);
  const yearValue = year ? yearFromFipe(year.name) : null;
  const invalid = !(brand && model && kmValue !== null && yearValue && yearValue > 1960 && yearValue < 2030);
  // FIPE names carry the version ("ONIX Lollapalooza 1.0 F.Power 5p Mec."); screens use the short names.
  const brandName = brand ? (brand.code ? fipeDisplayBrand(brand.name) : brand.name) : '';
  const modelName = model ? (model.code ? fipeDisplayModel(model.name) : model.name) : '';
  const hasPlan = useMemo(
    () => !!(catalogFile && brandName && modelName && findPlan(catalogFile.plans, brandName, modelName)),
    [catalogFile, brandName, modelName],
  );

  const changeType = (t: VehicleType) => {
    setType(t);
    setBrand(null);
    setModel(null);
    setYear(null);
  };

  const back = () => {
    if (mode === 'primeiro') void navigate({ to: '/entrar' });
    else goBack(navigate, '/');
  };

  const finish = async () => {
    if (!brand || !model) return toast('Escolha a marca e o modelo', 'err');
    if (kmValue === null) return toast('Informe o km atual do painel', 'err');
    if (invalid) return toast('Ano inválido. Use 4 dígitos, ex.: 2019', 'err');
    setSaving(true);
    const id = await createVehicle({
      type,
      brand: brandName,
      model: modelName,
      year: yearValue!,
      km: Math.round(kmValue),
      plate: null,
      fipeBrandCode: brand.code,
      fipeModelCode: model.code,
      fipeYearCode: year?.code && !local && !years.isError ? year.code : null,
      replacesVehicleId: replacing?.id ?? null,
    });
    setActive(id);
    toast(replacing ? `Veículo trocado · histórico do ${replacing.model} guardado` : 'Veículo cadastrado');
    void navigate({ to: '/', replace: true });
    if (m.vehicles.length === 0 && needsIosInstallGuide() && !useUi.getState().installGuideShown) {
      useUi.setState({ installGuideShown: true });
      setTimeout(() => openSheet({ type: 'install' }), 600);
    }
  };

  return (
    <div className="min-h-screen bg-page">
      <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-white shadow-shell-mobile tablet:max-w-none">
        <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-[26px] px-6 pt-[18px] pb-8">
          <div>
            <BackButton onClick={back} />
            <h1 className="m-0 mt-[18px] text-[30px] leading-[1.15] font-bold tracking-[-0.025em] text-pretty">
              Qual é o seu veículo?
            </h1>
            <div className="mt-2 text-[15.5px] text-pretty text-muted">
              Com isso o app escolhe os itens e os intervalos certos.
            </div>
            {replacing ? (
              <Notice className="mt-[14px]">
                Este veículo vai substituir o {replacing.model}. O histórico dele fica guardado em Conta › Veículos
                anteriores.
              </Notice>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="text-[13.5px] font-semibold" id="tipo-label">
              Tipo
            </div>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="tipo-label">
              {(['car', 'moto'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={type === t}
                  onClick={() => changeType(t)}
                  className={cn(
                    'flex h-32 flex-col items-center justify-center gap-1 rounded-14 bg-white p-2 font-semibold transition-transform active:scale-96',
                    type === t ? 'border-2 border-primary' : 'border border-border',
                  )}
                >
                  <VehicleImage type={t} size={84} />
                  {t === 'car' ? 'Carro' : 'Moto'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-[14px]">
            <Select
              label="Marca"
              placeholder={brands.isLoading ? 'Carregando…' : 'Selecione'}
              searchPlaceholder="Buscar marca"
              searchable
              options={brandOptions}
              value={brand ? (brand.code ?? brand.name) : ''}
              onChange={(value, o) => {
                setBrand(local ? LOCAL(value) : { code: value, name: o.label });
                setModel(null);
                setYear(null);
              }}
            />
            <Select
              label="Modelo"
              placeholder={brand ? (models.isLoading ? 'Carregando…' : 'Selecione') : 'Escolha a marca'}
              searchPlaceholder="Buscar modelo"
              searchable
              disabled={!brand}
              options={modelOptions}
              value={model ? (model.code ?? model.name) : ''}
              onChange={(value, o) => {
                setModel(local ? LOCAL(value) : { code: value, name: o.label });
                setYear(null);
              }}
            />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2.5">
            <Select
              label="Ano"
              placeholder="Ano"
              searchPlaceholder="Buscar ano"
              searchable
              options={yearOptions}
              value={year ? (year.code ?? year.name) : ''}
              onChange={(value, o) =>
                setYear(local || !model?.code || years.isError ? LOCAL(value) : { code: value, name: o.label })
              }
            />
            <Field label="Km atual">
              {id => (
                <Input
                  id={id}
                  inputSize="md"
                  inputMode="numeric"
                  placeholder="48.000"
                  className="tabular-nums"
                  value={km}
                  onChange={e => {
                    const n = parseNumber(e.target.value);
                    setKm(n === null ? '' : fmtInt(n));
                  }}
                />
              )}
            </Field>
          </div>

          {hasPlan ? (
            <Notice>Temos o plano do fabricante para este modelo. Os intervalos seguem o manual.</Notice>
          ) : null}

          <div className="flex-1" />
          <div className="flex flex-col gap-2">
            <Button block loading={saving} style={{ opacity: invalid ? 0.4 : 1 }} onClick={() => void finish()}>
              Começar
            </Button>
            <div className="text-center text-[13px] text-muted">Placa preenche tudo sozinha no Premium.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
