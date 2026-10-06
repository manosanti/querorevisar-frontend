// Design tokens extracted from docs/reference/QueroRevisar v7 responsivo.dc.html (see docs/design-system.md).
// This is the only place in the monorepo where raw color values are allowed.
// tokens.css mirrors these values; src/tokens.test.ts keeps both in sync.

export const colors = {
  primary: '#0e5a66',
  'primary-strong': '#0a434c',
  band: '#125865',
  'primary-tint': '#e7f0f1',
  ink: '#222222',
  'ink-2': '#555555',
  muted: '#6a6a6a',
  subtle: '#929292',
  border: '#dddddd',
  divider: '#ececec',
  'surface-1': '#f7f7f7',
  'surface-2': '#f4f4f4',
  'surface-3': '#f2f2f2',
  track: '#f0f0f0',
  page: '#ebeceb',
  white: '#ffffff',
  'over-fg': '#c13515',
  'over-bg': '#fdf1f0',
  'over-bar': '#c8372d',
  'over-label': '#8a1c16',
  'warn-fg': '#9a5b00',
  'warn-bg': '#fdf5e7',
  'warn-bar': '#d9890a',
  'warn-label': '#7a4800',
  'none-fg': '#929292',
  'control-border': '#c1c1c1',
  'ad-border': '#c1c1c1',
  success: '#1f6b45',
  scrim: 'rgba(0,0,0,.45)',
  'scrim-panel': 'rgba(0,0,0,.35)',
  'on-band-border': 'rgba(255,255,255,.55)',
  'on-dark-soft': 'rgba(255,255,255,.22)',
  'on-dark-faint': 'rgba(255,255,255,.14)',
  'spinner-track': 'rgba(255,255,255,.35)',
  'google-blue': '#4285F4',
  'google-green': '#34A853',
  'google-yellow': '#FBBC05',
  'google-red': '#EA4335',
} as const;

export type ColorToken = keyof typeof colors;

export const shadows = {
  'card-vehicle': 'rgba(0,0,0,.04) 0 0 0 1px, rgba(14,90,102,.10) 0 6px 14px 0, rgba(0,0,0,.08) 0 12px 28px -8px',
  dropdown: 'rgba(0,0,0,.02) 0 0 0 1px, rgba(0,0,0,.04) 0 2px 6px 0, rgba(0,0,0,.1) 0 4px 8px 0',
  popover: 'rgba(0,0,0,.02) 0 0 0 1px, rgba(0,0,0,.04) 0 2px 6px 0, rgba(0,0,0,.12) 0 8px 24px 0',
  segmented: 'rgba(0,0,0,.08) 0 1px 4px',
  'shell-mobile': '0 0 40px rgba(0,0,0,.06)',
  'side-panel': '0 0 40px rgba(0,0,0,.14)',
  toast: '0 10px 30px rgba(0,0,0,.22)',
} as const;

export const radii = {
  '4': '4px',
  '6': '6px',
  '8': '8px',
  '9': '9px',
  '10': '10px',
  '12': '12px',
  '14': '14px',
  '16': '16px',
  '18': '18px',
  '20': '20px',
  '24': '24px',
} as const;

export const breakpoints = { tablet: 768, desktop: 1100 } as const;

export const font = {
  family: 'Figtree, -apple-system, sans-serif',
  googleFontsHref: 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap',
} as const;

/** PWA manifest colors (theme_color = --band). */
export const pwa = { themeColor: colors.band, backgroundColor: colors.white } as const;
