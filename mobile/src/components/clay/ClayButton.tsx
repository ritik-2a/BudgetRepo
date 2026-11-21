import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type ClayButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title?: string;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  style?: PressableProps['style'];
};

export function ClayButton({
  title,
  icon,
  variant = 'primary',
  size = 'md',
  loading,
  fullWidth,
  disabled,
  onPress,
  style,
  ...rest
}: ClayButtonProps) {
  const t = useTheme();
  const solid = variant !== 'secondary';
  const bg =
    variant === 'primary'
      ? t.colors.primary
      : variant === 'danger'
        ? t.colors.danger
        : t.colors.surface;
  const fg = solid ? t.colors.onPrimary : t.colors.text;
  const height = size === 'lg' ? 52 : 44;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      android_ripple={{ color: solid ? 'rgba(255,255,255,0.18)' : t.colors.ripple }}
      onPress={(e) => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      style={(state) => [
        styles.base,
        {
          height,
          backgroundColor: bg,
          borderRadius: t.radius.md,
          borderWidth: solid ? 0 : 1,
          borderColor: t.colors.borderStrong,
          paddingHorizontal: title ? t.spacing.lg + 4 : 0,
          width: title ? undefined : height,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.45 : state.pressed ? 0.9 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          {title ? (
            <AppText variant="subtitle" color={fg} weight="600">
              {title}
            </AppText>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
