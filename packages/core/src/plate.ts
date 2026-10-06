// Brazilian plates: Mercosul (ABC1D23) and old format (ABC1234) share the regex below.
export const PLATE_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
export const PLATE_ERROR = 'Placa inválida. Use o formato ABC1D23';

/** Uppercase, letters and digits only, at most 7 characters. */
export function normalizePlate(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7);
}

export function isValidPlate(plate: string): boolean {
  return PLATE_REGEX.test(plate);
}

/** LGPD: plates never go to logs or analytics in full ("ABC1***"). */
export function maskPlate(plate: string): string {
  return plate.length <= 4 ? '***' : `${plate.slice(0, 4)}***`;
}
