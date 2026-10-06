// First-load skeletons, copied from the prototype layouts (blocks of --divider pulsing with qrsk).
import { Skeleton } from '@qr/ui';

const Row = ({ lead }: { lead?: number }) => (
  <div className="flex items-center gap-[14px] border-b border-border py-[14px]">
    {lead ? <Skeleton className="rounded-full" style={{ width: lead, height: lead }} /> : null}
    <div className="flex flex-1 flex-col gap-2">
      <Skeleton style={{ width: '62%', height: 16 }} />
      <Skeleton style={{ width: '44%', height: 12 }} />
    </div>
    <Skeleton className="rounded-12" style={{ width: 64, height: 24 }} />
  </div>
);

export function PainelSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col gap-[18px] px-[22px] pt-[22px] pb-6">
      <div className="flex items-center justify-between">
        <Skeleton style={{ width: 150, height: 28 }} />
        <Skeleton className="rounded-full" style={{ width: 36, height: 36 }} />
      </div>
      <div className="flex gap-2">
        <Skeleton className="rounded-24" style={{ width: 120, height: 48 }} />
        <Skeleton className="rounded-24" style={{ width: 120, height: 48 }} />
        <Skeleton className="rounded-24" style={{ width: 48, height: 48 }} />
      </div>
      <div className="flex flex-col gap-[18px] rounded-20 border border-border p-[18px]">
        <div className="flex justify-between gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton style={{ width: '55%', height: 22 }} />
            <Skeleton style={{ width: '35%', height: 14 }} />
          </div>
          <Skeleton className="rounded-12" style={{ width: 72, height: 56 }} />
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton style={{ width: 80, height: 12 }} />
            <Skeleton className="rounded-8" style={{ width: 130, height: 30 }} />
          </div>
          <Skeleton className="rounded-8" style={{ width: 120, height: 40 }} />
        </div>
      </div>
      <div className="flex gap-2">
        {[0, 1, 2].map(i => (
          <Skeleton key={i} className="flex-1 rounded-14" style={{ height: 72 }} />
        ))}
      </div>
      <div>
        <Skeleton style={{ width: 190, height: 22 }} />
        <Row />
        <Row />
        <Row />
      </div>
    </div>
  );
}

export function ListSkeleton({ title = 110 }: { title?: number }) {
  return (
    <div aria-busy="true" className="flex flex-1 flex-col gap-[14px] px-[22px] pt-[22px] pb-6">
      <Skeleton style={{ width: title, height: 30 }} />
      <Skeleton className="rounded-8" style={{ width: '100%', height: 52 }} />
      <div className="flex gap-2">
        <Skeleton className="rounded-20" style={{ width: 70, height: 36 }} />
        <Skeleton className="rounded-20" style={{ width: 150, height: 36 }} />
        <Skeleton className="rounded-20" style={{ width: 80, height: 36 }} />
      </div>
      <div>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <Row key={i} lead={40} />
        ))}
      </div>
    </div>
  );
}

/** Full-page placeholder while the session and the first sync load. */
export function ShellSkeleton() {
  return (
    <div className="min-h-screen bg-page">
      <div className="mx-auto min-h-screen max-w-[480px] bg-white">
        <PainelSkeleton />
      </div>
    </div>
  );
}
