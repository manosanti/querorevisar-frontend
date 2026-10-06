import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn.ts';

interface FieldProps {
  label?: ReactNode;
  helper?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: (id: string) => ReactNode;
}

/** Label (13.5px/600) + control + helper/error line. */
export function Field({ label, helper, error, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={id} className="text-[13.5px] font-semibold">
          {label}
        </label>
      ) : null}
      {children(id)}
      {error || helper ? (
        <span className={cn('text-[13px]', error ? 'text-over-fg' : 'text-muted')}>{error ?? helper}</span>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'filled';
  inputSize?: 'md' | 'lg';
}

/** Text input: 52px search/login style (filled = surface-1 background), 50px onboarding (md). */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { variant = 'default', inputSize = 'lg', className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full min-w-0 rounded-8 border border-border',
        inputSize === 'lg' ? 'h-[52px] px-4' : 'h-[50px] px-[14px]',
        variant === 'filled' ? 'bg-surface-1 text-[16px]' : 'bg-white',
        className,
      )}
      {...rest}
    />
  );
});

interface BigNumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  suffix: string;
  height?: number;
  fontSize?: number;
}

/** Large numeric input with a unit suffix inside a focused primary box (km fields in sheets). */
export const BigNumberInput = forwardRef<HTMLInputElement, BigNumberInputProps>(function BigNumberInput(
  { suffix, height = 54, fontSize = 22, className, ...rest },
  ref,
) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-8 border border-primary px-4 shadow-[0_0_0_1px_var(--primary)]',
        className,
      )}
    >
      <input
        ref={ref}
        data-bare=""
        inputMode="numeric"
        className="min-w-0 flex-1 border-0 bg-transparent font-semibold tabular-nums outline-0"
        style={{ height, fontSize }}
        {...rest}
      />
      <span className="text-[14px] font-medium text-muted">{suffix}</span>
    </div>
  );
});

interface InlineLabelInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/** Bordered box with a small label and a bare input ("Custo (R$)", "Marca da peça"). */
export const InlineLabelInput = forwardRef<HTMLInputElement, InlineLabelInputProps>(function InlineLabelInput(
  { label, className, ...rest },
  ref,
) {
  return (
    <label className={cn('flex flex-col rounded-8 border border-border px-[14px] py-2', className)}>
      <span className="text-[12px] text-muted">{label}</span>
      <input
        ref={ref}
        data-bare=""
        className="min-w-0 border-0 bg-transparent py-0.5 text-[15px] outline-0"
        {...rest}
      />
    </label>
  );
});
