import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/clay';
import { useTheme } from '@/theme';

/**
 * Full-screen branded loader shown while the app prepares data
 * (instead of a blank screen).
 */
export function FullScreenLoader({
  message = 'Loading…',
  hint,
}: {
  message?: string;
  hint?: string;
}) {
  const t = useTheme();

  return (
    <View
      style={[styles.full, { backgroundColor: t.colors.background }]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
    >
      <Image
        source={require('@/assets/images/logo.png')}
        style={styles.logoImage}
        accessibilityIgnoresInvertColors
      />
      <AppText variant="title" style={styles.brand}>
        Clayfin
      </AppText>
      <ActivityIndicator size="large" color={t.colors.primary} style={styles.spinner} />
      <AppText variant="subtitle">{message}</AppText>
      {hint ? (
        <AppText variant="caption" muted style={styles.center}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/** Small inline loader for a section/card that is still fetching. */
export function InlineLoader({ message = 'Loading…' }: { message?: string }) {
  const t = useTheme();
  return (
    <View style={styles.inline} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator color={t.colors.primary} />
      <AppText variant="caption" muted>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  logoImage: { width: 80, height: 80, borderRadius: 20 },
  brand: { marginTop: 16 },
  spinner: { marginTop: 24, marginBottom: 8 },
  center: { textAlign: 'center', maxWidth: 280 },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
  },
});
