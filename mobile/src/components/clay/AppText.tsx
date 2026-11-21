import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/theme';

type Variant = 'display' | 'title' | 'subtitle' | 'body' | 'caption' | 'label';

export type AppTextProps = TextProps & {
  variant?: Variant;
  muted?: boolean;
  color?: string;
  weight?: '400' | '500' | '600' | '700' | '800';
};

export function AppText({ variant = 'body', muted, color, weight, style, ...rest }: AppTextProps) {
  const { colors, fontSize } = useTheme();
  const v = {
    display: {
      fontSize: fontSize.xxl,
      fontWeight: '700' as const,
      letterSpacing: -0.6,
      fontVariant: ['tabular-nums' as const],
    },
    title: {
      fontSize: fontSize.lg,
      fontWeight: '600' as const,
      letterSpacing: -0.2,
      fontVariant: ['tabular-nums' as const],
    },
    subtitle: {
      fontSize: fontSize.md,
      fontWeight: '600' as const,
      fontVariant: ['tabular-nums' as const],
    },
    body: { fontSize: fontSize.md, fontWeight: '400' as const, lineHeight: 22 },
    caption: { fontSize: fontSize.sm, fontWeight: '400' as const, lineHeight: 19 },
    label: {
      fontSize: fontSize.xs,
      fontWeight: '600' as const,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
    },
  }[variant];

  return (
    <Text
      style={[
        v,
        { color: color ?? (muted ? colors.textMuted : colors.text) },
        weight ? { fontWeight: weight } : null,
        style,
      ]}
      {...rest}
    />
  );
}
