import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn.ts';
import { DotsIcon } from './icons.tsx';

export type ButtonVariant =
  'primary' | 'outline' | 'outline-neutral' | 'ghost' | 'text' | 'danger' | 'danger-text' | 'light' | 'dark';
export type ButtonSize = 'xl' | 'lg' | 'md' | 'sm' | 'pill';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white border-0',
  outline: 'bg-white text-primary border border-primary',
  'outline-neutral': 'bg-white text-ink border border-border',
  ghost: 'bg-transparent text-ink border-0 underline',
  text: 'bg-transparent text-primary border-0 underline',
  danger: 'bg-over-fg text-white border-0',
  'danger-text': 'bg-transparent text-over-fg border-0',
  light: 'bg-transparent text-white border-[1.5px] border-on-band-border',
  dark: 'bg-ink text-white border-0',
};

const SIZES: Record<ButtonSize, string> = {
  xl: 'h-[50px] rounded-8 text-[16px] px-4',
  lg: 'h-12 rounded-8 text-[16px] px-4',
  md: 'h-11 rounded-12 text-[14.5px] px-[14px]',
  sm: 'rounded-12 text-[14px] px-[14px] py-[9px]',
  pill: 'h-10 rounded-20 text-[14px] pl-[10px] pr-[14px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

/** Spinner used inside primary buttons while an action runs (18px, 2.5px border). */
export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="qr-spin inline-block rounded-full border-[2.5px] border-spinner-track border-t-white"
      style={{ width: size, height: size }}
    />
  );
}

export function Button({
  variant = 'primary',
  size = 'lg',
  block,
  loading,
  icon,
  className,
  children,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  const water = variant === 'outline' || variant === 'outline-neutral' ? '' : variant === 'light' ? 'light' : undefined;
  const textLike = variant === 'ghost' || variant === 'text' || variant === 'danger-text';
  return (
    <button
      type={type}
      data-water={water}
      disabled={disabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 font-semibold whitespace-nowrap transition-transform active:scale-96 disabled:cursor-not-allowed',
        VARIANTS[variant],
        textLike ? 'h-11 px-1' : SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

interface RoundButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: number;
}

/** "‹" round back/close button (40px, surface-3). */
export function BackButton({ label = 'Voltar', size = 40, className, ...rest }: Partial<RoundButtonProps>) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border-0 bg-surface-3 text-[20px] leading-none transition-transform active:scale-96',
        className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      ‹
    </button>
  );
}

/** Square 42px "…" button that opens the vehicle management sheet. */
export function ManageButton({ label = 'Gerenciar veículo', className, ...rest }: Partial<RoundButtonProps>) {
  return (
    <button
      type="button"
      aria-label={label}
      data-water=""
      className={cn(
        'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-12 border border-border bg-white text-ink transition-transform active:scale-96',
        className,
      )}
      {...rest}
    >
      <DotsIcon />
    </button>
  );
}

/** Round icon button (40/42/52px). */
export function IconButton({ label, size = 40, className, children, ...rest }: RoundButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('flex shrink-0 items-center justify-center transition-transform active:scale-96', className)}
      style={{ width: size, height: size }}
      {...rest}
    >
      {children}
    </button>
  );
}
