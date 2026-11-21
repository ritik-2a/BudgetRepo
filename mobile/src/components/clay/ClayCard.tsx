import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme';

export type ClayCardProps = ViewProps & {
  /** raised (default) = white card with hairline border; sunken = recessed panel */
  variant?: 'raised' | 'sunken';
  padded?: boolean;
  /** Solid background (e.g. hero cards); hides the border */
  tint?: string;
};

export function ClayCard({
  variant = 'raised',
  padded = true,
  tint,
  style,
  ...rest
}: ClayCardProps) {
  const t = useTheme();
  const sunken = variant === 'sunken';
  return (
    <View
      style={[
        {
          backgroundColor: tint ?? (sunken ? t.colors.surfaceSunken : t.colors.surface),
          borderRadius: t.radius.lg,
          borderWidth: tint || sunken ? 0 : 1,
          borderColor: t.colors.border,
          boxShadow: tint || sunken ? 'none' : t.shadow('raised'),
          padding: padded ? t.spacing.lg : 0,
        },
        style,
      ]}
      {...rest}
    />
  );
}
