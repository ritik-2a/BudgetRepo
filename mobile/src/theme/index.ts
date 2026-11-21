import { useColorScheme } from 'react-native';

import { clayShadow, fontSize, palettes, radius, spacing, type Palette } from './tokens';

export type Theme = {
  scheme: 'light' | 'dark';
  colors: Palette;
  radius: typeof radius;
  spacing: typeof spacing;
  fontSize: typeof fontSize;
  shadow: (variant?: 'raised' | 'pressed' | 'flat') => string;
};

const themes: Record<'light' | 'dark', Theme> = {
  light: {
    scheme: 'light',
    colors: palettes.light,
    radius,
    spacing,
    fontSize,
    shadow: (v) => clayShadow(palettes.light, v),
  },
  dark: {
    scheme: 'dark',
    colors: palettes.dark,
    radius,
    spacing,
    fontSize,
    shadow: (v) => clayShadow(palettes.dark, v),
  },
};

export function useTheme(): Theme {
  return themes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export { fontSize, palettes, radius, spacing };
