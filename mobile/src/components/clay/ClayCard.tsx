import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme';

export type ClayCardProps = ViewProps & {
  /** raised (default) pops out; sunken looks pressed in (e.g. inputs, progress tracks) */
  variant?: 'raised' | 'sunken';
  padded?: boolean;
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
          boxShadow: t.shadow(sunken ? 'pressed' : 'raised'),
          padding: padded ? t.spacing.lg : 0,
        },
        style,
      ]}
      {...rest}
    />
  );
}
