/**
 * Design tokens.
 *
 * Professional, calm finance look: warm neutral surfaces, one confident brand colour
 * (deep teal), muted semantic colours, thin borders and at most one soft shadow per
 * surface (cheap to render on Android, so scrolling and taps stay smooth).
 * Text colours keep WCAG-AA contrast on `surface` and `background` in both themes.
 */

export type ColorScheme = 'light' | 'dark';

const light = {
  background: '#F5F6F4',
  surface: '#FFFFFF',
  surfaceSunken: '#EFF1EE',
  surfaceRaised: '#FFFFFF',
  border: '#E2E5E1',
  borderStrong: '#CBD1CC',
  text: '#141A1F',
  textMuted: '#5A6570',
  primary: '#0F766E',
  primarySoft: '#E3F2EF',
  onPrimary: '#FFFFFF',
  /** Headline cards (balances, outstanding) */
  hero: '#0E3D38',
  onHero: '#FFFFFF',
  onHeroMuted: 'rgba(255,255,255,0.74)',
  heroTrack: 'rgba(255,255,255,0.18)',
  /** Snackbars / toasts */
  inverse: '#1C2329',
  onInverse: '#F2F5F3',
  // Semantic money colours
  expense: '#C8413B',
  income: '#13805B',
  investment: '#2A64C8',
  transfer: '#5F6B78',
  travel: '#B26A12',
  creditCard: '#A8395F',
  warning: '#B26A12',
  danger: '#C62828',
  ripple: 'rgba(15, 118, 110, 0.10)',
  shadow: 'rgba(16, 24, 32, 0.07)',
};

const dark: typeof light = {
  background: '#0F1416',
  surface: '#171D20',
  surfaceSunken: '#12171A',
  surfaceRaised: '#1D2428',
  border: '#252D32',
  borderStrong: '#34404A',
  text: '#E8EDEB',
  textMuted: '#9AA6AB',
  primary: '#3CC3AA',
  primarySoft: '#16302C',
  onPrimary: '#06201C',
  hero: '#123A35',
  onHero: '#EAF7F4',
  onHeroMuted: 'rgba(234,247,244,0.72)',
  heroTrack: 'rgba(234,247,244,0.16)',
  inverse: '#E8EDEB',
  onInverse: '#141A1F',
  expense: '#F0857E',
  income: '#45C98F',
  investment: '#78A6F5',
  transfer: '#9AA6B4',
  travel: '#E9A23B',
  creditCard: '#E681A6',
  warning: '#E9A23B',
  danger: '#FF7A70',
  ripple: 'rgba(60, 195, 170, 0.14)',
  shadow: 'rgba(0, 0, 0, 0)',
};

export const palettes = { light, dark } as const;
export type Palette = typeof light;

export const radius = { sm: 10, md: 12, lg: 16, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const fontSize = { xs: 12, sm: 14, md: 16, lg: 18, xl: 24, xxl: 30 } as const;

/**
 * One soft outer shadow for raised surfaces in light mode; nothing in dark mode
 * (borders separate surfaces there). 'pressed' / 'flat' draw no shadow.
 */
export function clayShadow(p: Palette, variant: 'raised' | 'pressed' | 'flat' = 'raised'): string {
  if (variant !== 'raised' || p.shadow === 'rgba(0, 0, 0, 0)') return 'none';
  return `0px 1px 3px ${p.shadow}`;
}

/**
 * Category / chart colours: the validated 8-hue categorical palette (fixed order),
 * plus a neutral for "Other".
 */
export const CATEGORY_PALETTE = [
  '#2A78D6', // blue
  '#EB6834', // orange
  '#1BAF7A', // aqua
  '#EDA100', // yellow
  '#E87BA4', // magenta
  '#008300', // green
  '#6250D6', // violet
  '#E34948', // red
  '#64748B', // slate
  '#8A8F98', // grey
] as const;
