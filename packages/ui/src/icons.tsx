// Interface icons: 24×24 SVG paths with round caps (docs/design-system.md#assets).
// Tab icons come from TAB_ICONS of the prototype; catalog icons come from data/catalog.json.
import type { SVGProps } from 'react';
import carUrl from './assets/brand/icone-carro.webp';
import motoUrl from './assets/brand/icone-moto.webp';

export const TAB_ICONS = {
  painel: ['M3.05 13a9 9 0 1 1 17.9 0', 'M12 14 18 8'],
  itens: ['M8 6h13M8 12h13M8 18h13', 'M3 6h.01M3 12h.01M3 18h.01'],
  historico: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5', 'M12 7v5l3 2'],
  conta: ['M20 21a8 8 0 0 0-16 0', 'M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z'],
  consultas: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'm21 21-4.3-4.3'],
} as const;

export const ICON_PATHS = {
  plus: ['M12 5v14M5 12h14'],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronRight: ['m9 6 6 6-6 6'],
  chevronLeft: ['m15 18-6-6 6-6'],
  check: ['M20 6 9 17l-5-5'],
  swap: ['M17 3l4 4-4 4', 'M3 7h18', 'M7 21l-4-4 4-4', 'M21 17H3'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M6 6l1 14h10l1-14'],
  calendar: ['M3 9.5h18M8 2.5v4M16 2.5v4'],
  search: ['m20 20-3.5-3.5'],
} as const;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  paths: readonly string[];
  size?: number;
  strokeWidth?: number;
}

export function Icon({ paths, size = 18, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths.map(d => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function PlusIcon({ size = 18 }: { size?: number }) {
  return <Icon paths={ICON_PATHS.plus} size={size} strokeWidth={2.4} />;
}

export function DotsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

export function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function CalendarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

export function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="var(--google-blue)"
        d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"
      />
      <path
        fill="var(--google-green)"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"
      />
      <path fill="var(--google-yellow)" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
      <path
        fill="var(--google-red)"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"
      />
    </svg>
  );
}

export function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 17 20" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9a4.8 4.8 0 0 0-3.8-2c-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9A5 5 0 0 0 1 7.3c-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3 0 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.5a11 11 0 0 0 1.4-2.9 4.5 4.5 0 0 1-2.6-4zM11.6 3.1A4.4 4.4 0 0 0 12.6 0a4.6 4.6 0 0 0-3 1.5 4.2 4.2 0 0 0-1 3c1.1.1 2.3-.6 3-1.4z" />
    </svg>
  );
}

export type VehicleKind = 'car' | 'moto';

export const VEHICLE_IMAGES: Record<VehicleKind, string> = { car: carUrl, moto: motoUrl };

interface VehicleImageProps {
  type: VehicleKind;
  size: number;
  alt?: string;
  className?: string;
  muted?: boolean;
}

/** Isometric car/motorcycle illustration (brand/icone-carro.png, icone-moto.png). */
export function VehicleImage({ type, size, alt = '', className, muted }: VehicleImageProps) {
  return (
    <img
      src={VEHICLE_IMAGES[type]}
      alt={alt}
      title={alt || undefined}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        flex: 'none',
        ...(muted ? { opacity: 0.55, filter: 'grayscale(1)' } : {}),
      }}
    />
  );
}
