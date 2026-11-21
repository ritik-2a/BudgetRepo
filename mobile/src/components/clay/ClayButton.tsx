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
  const bg =
    variant === 'primary'
      ? t.colors.primary
      : variant === 'danger'
        ? t.colors.danger
        : t.colors.surface;
  const fg = variant === 'secondary' ? t.colors.text : t.colors.onPrimary;
  const height = size === 'lg' ? 56 : 46;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
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
          paddingHorizontal: title ? t.spacing.xl : 0,
          width: title ? undefined : height,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          boxShadow: t.shadow(state.pressed ? 'pressed' : 'raised'),
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: state.pressed ? 0.97 : 1 }],
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
          {title ? (
            <AppText variant="subtitle" color={fg}>
              {title}
            </AppText>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
