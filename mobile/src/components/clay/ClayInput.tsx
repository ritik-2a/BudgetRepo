import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { useEnsureVisible } from './keyboard';

export type ClayInputProps = TextInputProps & {
  label?: string;
  error?: string;
  /** Rendered before the text, e.g. "₹" */
  prefix?: string;
};

/** `ref` (React 19) is forwarded to the TextInput via `rest`. */
export function ClayInput({
  label,
  error,
  prefix,
  style,
  onFocus,
  onBlur,
  ...rest
}: ClayInputProps) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const ensureVisible = useEnsureVisible();
  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="label" muted>
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: t.colors.surface,
            borderRadius: t.radius.md,
            borderColor: error ? t.colors.danger : focused ? t.colors.primary : t.colors.border,
          },
        ]}
      >
        {prefix ? (
          <AppText variant="subtitle" muted>
            {prefix}
          </AppText>
        ) : null}
        <TextInput
          placeholderTextColor={t.colors.textMuted}
          selectionColor={t.colors.primary}
          cursorColor={t.colors.primary}
          style={[styles.input, { color: t.colors.text, fontSize: t.fontSize.md }, style]}
          onFocus={(e) => {
            setFocused(true);
            ensureVisible();
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
      </View>
      {error ? (
        <AppText variant="caption" color={t.colors.danger}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    minHeight: 48,
    borderWidth: 1,
  },
  input: { flex: 1, paddingVertical: 10 },
});
