// Lookup result: plate, model, product · date, colored summary, sections, legal note, PDF and "Nova consulta".
import { api, type LookupResult } from '@qr/api-client';
import { lookupProduct } from '@qr/core';
import { BackButton, Button, PlateTag, Skeleton, ToneBadge, cn } from '@qr/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { qk } from '../../lib/data/query.ts';

const SUMMARY_TONE = {
  ok: 'bg-primary-tint text-primary',
  warn: 'bg-warn-bg text-warn-fg',
  over: 'bg-over-bg text-over-fg',
} as const;

export const lookupDate = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');

export function useLookup(id: string) {
  return useQuery({ queryKey: qk.lookup(id), queryFn: () => api.getLookup(id), staleTime: Infinity });
}

export function LookupSections({ result }: { result: LookupResult }) {
  return (
    <>
      <div className={cn('rounded-14 px-4 py-[14px] text-[15px] font-semibold', SUMMARY_TONE[result.summary.tone])}>
        {result.summary.text}
      </div>
      {result.sections.map(sec => (
        <section key={sec.key}>
          <h2 className="m-0 mb-0.5 text-[18px] font-semibold tracking-[-0.02em]">{sec.title}</h2>
          {sec.rows.map(row => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 border-b border-border py-3 text-[15px]"
            >
              <span className="text-muted">{row.label}</span>
              {row.tone ? (
                <ToneBadge tone={row.tone} className="text-right">
                  {row.value}
                </ToneBadge>
              ) : (
                <span className="text-right font-semibold tabular-nums">{row.value}</span>
              )}
            </div>
          ))}
        </section>
      ))}
      <div className="text-[12.5px] text-pretty text-subtle">
        Dados das bases consultadas no momento da pesquisa. Confira a documentação do veículo antes de fechar negócio.
      </div>
    </>
  );
}

export function ConsultaResult({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data: r, isError } = useLookup(id);
  const back = () => void navigate({ to: '/consultas', search: { modo: 'outro' } });

  return (
    <>
      <div className="flex flex-1 flex-col gap-5 px-[22px] pt-[18px]">
        <BackButton onClick={back} />
        {r ? (
          <>
            <div className="flex flex-col gap-2.5">
              <PlateTag plate={r.plate} size="lg" />
              <div>
                <h1 className="m-0 text-[26px] leading-[1.15] font-bold tracking-[-0.02em]">
                  {r.vehicle.model} {r.vehicle.year}
                </h1>
                <div className="mt-1 text-[14px] text-muted">
                  {lookupProduct(r.product).name} · {lookupDate(r.createdAt)}
                </div>
              </div>
            </div>
            <LookupSections result={r} />
          </>
        ) : isError ? (
          <div className="text-muted">Não foi possível abrir esta consulta. Verifique a conexão e tente de novo.</div>
        ) : (
          <div aria-busy="true" className="flex flex-col gap-3">
            <Skeleton style={{ width: 140, height: 40 }} />
            <Skeleton style={{ width: '70%', height: 28 }} />
            <Skeleton className="rounded-14" style={{ height: 52 }} />
            <Skeleton style={{ height: 200 }} />
          </div>
        )}
      </div>
      <div className="flex flex-none flex-col gap-2.5 px-[22px] pt-5 pb-[30px]">
        {r?.product === 'laudo' ? (
          <Button block onClick={() => void navigate({ to: '/laudo/$id', params: { id } })}>
            Baixar laudo em PDF
          </Button>
        ) : null}
        <Button block variant="outline" onClick={back}>
          Nova consulta
        </Button>
      </div>
    </>
  );
}
