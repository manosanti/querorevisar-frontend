import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn.ts';

interface PlateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (plate: string) => void;
}

const normalize = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7);

/** 64px plate field: 28px/700, letter-spacing .14em, 2px ink border, radius 10. */
export const PlateInput = forwardRef<HTMLInputElement, PlateInputProps>(function PlateInput(
  { value, onChange, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      value={value}
      onChange={e => onChange(normalize(e.target.value))}
      placeholder="ABC1D23"
      maxLength={8}
      autoCapitalize="characters"
      autoComplete="off"
      spellCheck={false}
      className={cn(
        'h-16 w-full rounded-10 border-2 border-ink bg-white px-4 text-center text-[28px] font-bold tracking-[.14em] uppercase',
        className,
      )}
      {...rest}
    />
  );
});
