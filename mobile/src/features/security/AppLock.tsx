import Ionicons from '@expo/vector-icons/Ionicons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  AppState,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BRAND, BrandBackdrop } from '@/components/brand/BrandBackdrop';
import { PulseRings } from '@/components/brand/BrandMotion';

import { getPrefs } from '../settings/repo';

/** Re-lock after the app has been in the background this long. */
const RELOCK_AFTER_MS = 30_000;

export async function canUseAppLock(): Promise<{ ok: boolean; reason?: string }> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level === LocalAuthentication.SecurityLevel.NONE) {
    return {
      ok: false,
      reason: hasHardware
        ? 'Set up a fingerprint, face unlock or screen lock PIN on your phone first.'
        : 'Set up a screen lock PIN on your phone first.',
    };
  }
  return { ok: true };
}

export async function authenticate(reason = 'Unlock Clayfin'): Promise<boolean> {
  return (await authenticateDetailed(reason)).success;
}

/** Like authenticate(), but tells a deliberate cancel apart from a failed attempt. */
export async function authenticateDetailed(
  reason = 'Unlock Clayfin',
): Promise<{ success: boolean; cancelled: boolean }> {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  if (res.success) return { success: true, cancelled: false };
  const cancelled = ['user_cancel', 'system_cancel', 'app_cancel'].includes(res.error);
  return { success: false, cancelled };
}

/**
 * Covers the app with a lock screen when App lock is on: at launch and when
 * returning after more than 30 seconds in the background.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(() => getPrefs().appLock);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await authenticateDetailed();
      if (r.success) setLocked(false);
      // A cancel isn't an error: just leave the lock screen waiting for a tap.
      else if (!r.cancelled) setError("That didn't match. Try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    // Prompt right after mount (deferred so it isn't a synchronous setState in the effect).
    const initial = locked ? setTimeout(unlock, 0) : null;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (getPrefs().appLock && away > RELOCK_AFTER_MS) {
          setLocked(true);
          unlock();
        }
      }
    });
    return () => {
      if (initial) clearTimeout(initial);
      sub.remove();
    };
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.flex}>
      {children}
      {locked ? <LockScreen busy={busy} error={error} onUnlock={unlock} /> : null}
    </View>
  );
}

const FOCUS_Y = 0.3;
const LOGO = 92;
const PRINT = 84;

/** Premium lock screen: logo in fine rings, radiating fingerprint button, privacy note. */
function LockScreen({
  busy,
  error,
  onUnlock,
}: {
  busy: boolean;
  error: string | null;
  onUnlock: () => void;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const logoCenter = height * FOCUS_Y;
  const printCenter = height * 0.68;

  return (
    <View style={[StyleSheet.absoluteFill, styles.lock]} accessibilityViewIsModal>
      <StatusBar style="light" />
      <BrandBackdrop focusY={FOCUS_Y} />

      <View style={[styles.logoWrap, { top: logoCenter - LOGO / 2 }]}>
        <View style={styles.logoGlow} />
        <Image source={require('@/assets/images/logo.png')} style={styles.logo} />
      </View>

      <View style={[styles.copy, { top: logoCenter + LOGO / 2 + 22 }]}>
        <Text style={styles.brand}>Clayfin</Text>
        <Text style={styles.tagline}>Your money, privately yours</Text>
      </View>

      <View style={[styles.printWrap, { top: printCenter - PRINT / 2 }]}>
        <View style={{ width: PRINT, height: PRINT }}>
          <PulseRings size={PRINT} />
          <Pressable
            onPress={onUnlock}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Unlock with fingerprint, face or PIN"
            android_ripple={{ color: 'rgba(255,255,255,0.2)', radius: PRINT / 2 }}
            style={styles.print}
          >
            {busy ? (
              <ActivityIndicator color={BRAND.text} />
            ) : (
              <Ionicons name="finger-print" size={40} color={BRAND.text} />
            )}
          </Pressable>
        </View>
        <Text style={styles.touch}>{busy ? 'Verifying…' : 'Touch to unlock'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={[styles.footer, { bottom: insets.bottom + 24 }]}>
        <Ionicons name="lock-closed" size={13} color={BRAND.textMuted} />
        <Text style={styles.footerText}>Locked · your data stays on this phone</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lock: { zIndex: 2000, backgroundColor: BRAND.deep },
  logoWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  logoGlow: {
    position: 'absolute',
    top: -18,
    width: LOGO + 36,
    height: LOGO + 36,
    borderRadius: (LOGO + 36) / 2,
    backgroundColor: 'rgba(60, 195, 170, 0.16)',
  },
  logo: { width: LOGO, height: LOGO, borderRadius: 24 },
  copy: { position: 'absolute', left: 32, right: 32, alignItems: 'center', gap: 6 },
  brand: { color: BRAND.text, fontSize: 30, fontWeight: '600', letterSpacing: 0.4 },
  tagline: { color: BRAND.textMuted, fontSize: 15 },
  printWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 18 },
  print: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: PRINT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(60, 195, 170, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(160, 235, 220, 0.45)',
    overflow: 'hidden',
  },
  touch: { color: BRAND.text, fontSize: 16, fontWeight: '500', letterSpacing: 0.2 },
  error: { color: '#FFB4A8', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  footerText: { color: BRAND.textMuted, fontSize: 13 },
});
