import Ionicons from '@expo/vector-icons/Ionicons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { AppText, ClayButton } from '@/components/clay';
import { useTheme } from '@/theme';

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

export async function authenticate(reason = 'Unlock Budget Tracker'): Promise<boolean> {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  return res.success;
}

/**
 * Covers the app with a lock screen when App lock is on: at launch and when
 * returning after more than 30 seconds in the background.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const t = useTheme();
  const [locked, setLocked] = useState(() => getPrefs().appLock);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (await authenticate()) setLocked(false);
      else setError('Not unlocked. Try again.');
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
      {locked ? (
        <View
          style={[StyleSheet.absoluteFill, styles.lock, { backgroundColor: t.colors.background }]}
          accessibilityViewIsModal
        >
          <View
            style={[
              styles.icon,
              { backgroundColor: t.colors.primary, boxShadow: t.shadow('raised') },
            ]}
          >
            <Ionicons name="lock-closed" size={40} color={t.colors.onPrimary} />
          </View>
          <AppText variant="title">Budget Tracker is locked</AppText>
          <AppText variant="caption" muted style={styles.center}>
            Use your fingerprint, face or phone PIN to continue.
          </AppText>
          {error ? (
            <AppText variant="caption" color={t.colors.danger}>
              {error}
            </AppText>
          ) : null}
          <ClayButton title="Unlock" icon="finger-print" loading={busy} onPress={unlock} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lock: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, zIndex: 2000 },
  icon: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
