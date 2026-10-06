// Sheet: bottom sheet below 768px, full-height 480px panel on the right from 768px.
// SidePanel: full screen on mobile, right panel with the list visible behind from 768px.
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { cn } from './cn.ts';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function useDialogBehavior(open: boolean, onClose: () => void, panelRef: RefObject<HTMLDivElement | null>) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!items.length) return;
        const firstEl = items[0]!;
        const lastEl = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, panelRef]);
}

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  className?: string;
}

export function Sheet({ open, onClose, label, children, className }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehavior(open, onClose, panelRef);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-scrim tablet:items-stretch tablet:justify-end"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className={cn(
          'flex max-h-[92vh] w-full max-w-[480px] flex-col gap-[18px] overflow-y-auto rounded-t-20 bg-white px-[22px] pt-2.5 pb-[30px] outline-0',
          'tablet:h-screen tablet:max-h-screen tablet:rounded-none',
          className,
        )}
      >
        <div aria-hidden="true" className="h-[5px] w-10 shrink-0 self-center rounded-[3px] bg-border" />
        {children}
      </div>
    </div>
  );
}

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}

export function SidePanel({ open, onClose, label, children }: SidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehavior(open, onClose, panelRef);
  if (!open) return null;
  return (
    <div
      data-screen-label={label}
      className="fixed inset-0 z-20 flex justify-center bg-page tablet:justify-end tablet:bg-scrim-panel"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="flex w-full max-w-[480px] flex-col overflow-y-auto bg-white outline-0 tablet:shadow-side-panel"
      >
        {children}
      </div>
    </div>
  );
}

/** Sheet header: title (22/700), optional subtitle and a "Cancelar"-style action on the right. */
export function SheetTitle({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="m-0 text-[22px] font-bold tracking-[-0.02em]">{title}</h2>
        {subtitle ? <div className="text-[13.5px] text-muted">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  );
}
