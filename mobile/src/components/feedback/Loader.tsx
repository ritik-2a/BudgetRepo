import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { BRAND, BrandBackdrop } from '@/components/brand/BrandBackdrop';
import { OrbitArc } from '@/components/brand/BrandMotion';
import { AppText } from '@/components/clay';
import { useTheme } from '@/theme';

const FOCUS_Y = 0.42;
const LOGO = 96;
const ORBIT = 152;

/**
 * Full-screen branded loader: deep-teal backdrop, the logo centred in fine rings with a
 * gold arc orbiting it, then the name and what's happening.
 */
export function FullScreenLoader({
  message = 'Loading…',
  hint,
}: {
  message?: string;
  hint?: string;
}) {
  const { height } = useWindowDimensions();
  const centerY = height * FOCUS_Y;

  return (
    <View
      style={styles.full}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
    >
      <StatusBar style="light" />
      <BrandBackdrop focusY={FOCUS_Y} />

      <View style={[styles.orbit, { top: centerY - ORBIT / 2 }]}>
        <OrbitArc size={ORBIT} />
        <Image
          source={require('@/assets/images/logo.png')}
          style={styles.logo}
          accessibilityIgnoresInvertColors
        />
      </View>

      <View style={[styles.copy, { top: centerY + ORBIT / 2 + 20 }]}>
        <Text style={styles.brand}>Clayfin</Text>
        <Text style={styles.message}>{message}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
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
  full: { flex: 1, backgroundColor: BRAND.deep },
  orbit: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ORBIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    position: 'absolute',
    width: LOGO,
    height: LOGO,
    borderRadius: 24,
  },
  copy: { position: 'absolute', left: 32, right: 32, alignItems: 'center', gap: 6 },
  brand: {
    color: BRAND.text,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  message: { color: BRAND.textMuted, fontSize: 15, marginTop: 4 },
  hint: { color: BRAND.textMuted, fontSize: 13, textAlign: 'center', opacity: 0.8 },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
  },
});
