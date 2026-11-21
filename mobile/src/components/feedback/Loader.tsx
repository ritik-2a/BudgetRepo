import { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

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
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [scale]);

  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View
      style={[styles.full, { backgroundColor: t.colors.background }]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={[styles.logo, { boxShadow: t.shadow('raised') }, logoStyle]}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.logoImage}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
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
  logo: { width: 96, height: 96, borderRadius: 24 },
  logoImage: { width: 96, height: 96, borderRadius: 24 },
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
