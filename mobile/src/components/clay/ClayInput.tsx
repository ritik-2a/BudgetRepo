import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

export type ClayInputProps = TextInputProps & {
  label?: string;
  error?: string;
  /** Rendered before the text, e.g. "₹" */
  prefix?: string;
};

/** `ref` (React 19) is forwarded to the TextInput via `rest`. */
export function ClayInput({ label, error, prefix, style, ...rest }: ClayInputProps) {
  const t = useTheme();
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
            backgroundColor: t.colors.surfaceSunken,
            borderRadius: t.radius.md,
            boxShadow: t.shadow('pressed'),
            borderColor: error ? t.colors.danger : 'transparent',
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
          style={[styles.input, { color: t.colors.text, fontSize: t.fontSize.md }, style]}
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
    paddingHorizontal: 16,
    minHeight: 50,
    borderWidth: 1.5,
  },
  input: { flex: 1, paddingVertical: 12 },
});
