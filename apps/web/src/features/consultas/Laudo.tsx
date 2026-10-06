// /laudo/$id: printable report with print CSS; "Baixar PDF" uses the browser's print to PDF (F10.2).
import { lookupProduct } from '@qr/core';
import { BackButton, Button, PlateTag } from '@qr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { goBack } from '../../lib/navigation.ts';
import { lookupDate, LookupSections, useLookup } from './ConsultaResult.tsx';

export function Laudo({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data: r, isError } = useLookup(id);

  useEffect(() => {
    if (!r) return;
    const prev = document.title;
    document.title = `Laudo ${r.plate} · QueroRevisar`;
    return () => {
      document.title = prev;
    };
  }, [r]);

  return (
    <div className="min-h-screen bg-page print:bg-white">
      <div className="mx-auto flex min-h-screen max-w-[720px] flex-col gap-5 bg-white px-[22px] pt-[18px] pb-10 print:max-w-none print:px-0">
        <div className="qr-no-print flex items-center justify-between">
          <BackButton onClick={() => goBack(navigate, `/consultas/${id}`)} />
          <Button size="md" disabled={!r} onClick={() => window.print()}>
            Baixar PDF
          </Button>
        </div>
        <header className="flex items-center justify-between gap-4 border-b border-border pb-4">
          <img src="/brand/logo-horizontal.webp" alt="QueroRevisar" className="h-[30px] w-auto" />
          <span className="text-[13px] text-muted">Laudo cautelar</span>
        </header>
        {r ? (
          <>
            <div className="flex flex-col gap-2.5">
              <PlateTag plate={r.plate} size="lg" />
              <h1 className="m-0 text-[26px] leading-[1.15] font-bold tracking-[-0.02em]">
                {r.vehicle.model} {r.vehicle.year}
              </h1>
              <div className="text-[14px] text-muted">
                {lookupProduct(r.product).name} · {lookupDate(r.createdAt)}
              </div>
            </div>
            <LookupSections result={r} />
          </>
        ) : isError ? (
          <div className="text-muted">Não foi possível abrir este laudo. Verifique a conexão e tente de novo.</div>
        ) : (
          <div className="text-muted">Carregando…</div>
        )}
      </div>
    </div>
  );
}
