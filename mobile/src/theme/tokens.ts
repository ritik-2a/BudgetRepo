/**
 * Design tokens for the claymorphic UI.
 *
 * Clay look = soft pastel surfaces, large radii, a soft outer drop shadow plus an
 * inset highlight (top-left) and inset shade (bottom-right). Text colours are
 * chosen to keep WCAG-AA contrast (>= 4.5:1) against `surface` and `background`.
 */

export type ColorScheme = 'light' | 'dark';

const light = {
  background: '#E9ECF5',
  surface: '#F4F6FC',
  surfaceSunken: '#E1E5F0',
  text: '#23263A',
  textMuted: '#555A72',
  border: '#D5DAE8',
  primary: '#5B50E6',
  onPrimary: '#FFFFFF',
  // Semantic money colours (used on chips/bars; text-on-surface variants are darker)
  expense: '#E0565B',
  income: '#1F9D75',
  investment: '#2F7BE0',
  transfer: '#7A6FF0',
  travel: '#C97A0E',
  creditCard: '#C2417F',
  warning: '#C97A0E',
  danger: '#D13C43',
  // Clay shadow parts
  shadowDark: 'rgba(120, 130, 170, 0.35)',
  highlight: 'rgba(255, 255, 255, 0.85)',
  innerShade: 'rgba(120, 130, 170, 0.18)',
};

const dark: typeof light = {
  background: '#171925',
  surface: '#222536',
  surfaceSunken: '#1B1D2B',
  text: '#ECEEF7',
  textMuted: '#A9ADC4',
  border: '#33374C',
  primary: '#8B82FF',
  onPrimary: '#14121F',
  expense: '#FF8589',
  income: '#4FD1A5',
  investment: '#6AA8FF',
  transfer: '#A79FFF',
  travel: '#FFB547',
  creditCard: '#F07AB4',
  warning: '#FFB547',
  danger: '#FF6B70',
  shadowDark: 'rgba(0, 0, 0, 0.55)',
  highlight: 'rgba(255, 255, 255, 0.07)',
  innerShade: 'rgba(0, 0, 0, 0.35)',
};

export const palettes = { light, dark } as const;
export type Palette = typeof light;

export const radius = { sm: 12, md: 18, lg: 26, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const fontSize = { xs: 12, sm: 14, md: 16, lg: 20, xl: 26, xxl: 34 } as const;

/**
 * Builds a CSS-style `boxShadow` string (supported by React Native's New Architecture)
 * for raised or pressed clay surfaces.
 */
export function clayShadow(p: Palette, variant: 'raised' | 'pressed' | 'flat' = 'raised'): string {
  if (variant === 'flat') return 'none';
  if (variant === 'pressed') {
    return [`inset 4px 4px 8px ${p.innerShade}`, `inset -3px -3px 6px ${p.highlight}`].join(', ');
  }
  return [
    `8px 10px 20px ${p.shadowDark}`,
    `inset 3px 3px 6px ${p.highlight}`,
    `inset -4px -4px 8px ${p.innerShade}`,
  ].join(', ');
}
