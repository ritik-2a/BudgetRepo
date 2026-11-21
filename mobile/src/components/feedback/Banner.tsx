import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/clay';
import { useTheme } from '@/theme';

import { useToneColors, type Tone } from './tones';

/** Inline message strip inside a screen, e.g. "You've used 85% of your Food budget". */
export function Banner({
  tone = 'info',
  title,
  message,
  onDismiss,
}: {
  tone?: Tone;
  title?: string;
  message: string;
  onDismiss?: () => void;
}) {
  const t = useTheme();
  const { color, icon } = useToneColors(tone);
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : 'summary'}
      style={[
        styles.wrap,
        {
          backgroundColor: color + (t.scheme === 'dark' ? '26' : '1A'),
          borderColor: color + '55',
          borderRadius: t.radius.md,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <View style={styles.text}>
        {title ? (
          <AppText variant="subtitle" color={t.colors.text}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="caption">{message}</AppText>
      </View>
      {onDismiss ? (
        <Pressable onPress={onDismiss} accessibilityLabel="Dismiss" hitSlop={10}>
          <Ionicons name="close" size={18} color={t.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderWidth: 1 },
  text: { flex: 1, gap: 2 },
});
