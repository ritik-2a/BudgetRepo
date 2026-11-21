import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/clay';
import { useTheme } from '@/theme';

import { errorMessage } from './States';
import { useToneColors, type Tone } from './tones';

export type ToastOptions = {
  title: string;
  message?: string;
  /** ms before auto-dismiss. Errors stay longer by default. */
  duration?: number;
  action?: { label: string; onPress: () => void };
};

type ToastItem = ToastOptions & { id: number; tone: Tone };

type ToastApi = {
  show: (tone: Tone, opts: ToastOptions) => void;
  success: (title: string, message?: string) => void;
  /** Accepts a thrown error and shows its text. */
  error: (title: string, error?: unknown) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);
/** Space kept above the docked tab bar. */
const BOTTOM_OFFSET = 76;

/**
 * Snackbar-style messages: one at a time, fading in just above the tab bar.
 * A new message replaces the current one (no stacking or sliding).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const nextId = useRef(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback((id: number) => {
    setToast((cur) => (cur && cur.id === id ? null : cur));
  }, []);

  const show = useCallback(
    (tone: Tone, opts: ToastOptions) => {
      const id = nextId.current++;
      if (timer.current) clearTimeout(timer.current);
      setToast({ ...opts, id, tone });

      if (tone === 'error' || tone === 'warning') {
        Haptics.notificationAsync(
          tone === 'error'
            ? Haptics.NotificationFeedbackType.Error
            : Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
      }
      AccessibilityInfo.announceForAccessibility(
        [opts.title, opts.message].filter(Boolean).join('. '),
      );

      const duration = opts.duration ?? (opts.action ? 5000 : tone === 'error' ? 5000 : 2800);
      timer.current = setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, message) => show('success', { title, message }),
      error: (title, error) => show('error', { title, message: errorMessage(error) ?? undefined }),
      warning: (title, message) => show('warning', { title, message }),
      info: (title, message) => show('info', { title, message }),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toast={toast} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

function ToastViewport({
  toast,
  onDismiss,
}: {
  toast: ToastItem | null;
  onDismiss: (id: number) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[styles.viewport, { bottom: insets.bottom + BOTTOM_OFFSET }]}
    >
      {toast ? (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ) : null}
    </View>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const t = useTheme();
  const { color, icon } = useToneColors(toast.tone);
  // On the dark snackbar use the lighter (dark-theme) tone colours for contrast.
  const iconColor = t.scheme === 'dark' ? color : lightenForInverse(toast.tone);

  return (
    <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)}>
      <Pressable
        onPress={onDismiss}
        accessibilityRole={toast.tone === 'error' ? 'alert' : 'button'}
        accessibilityHint="Tap to dismiss"
        style={[styles.card, { backgroundColor: t.colors.inverse, borderRadius: t.radius.md }]}
      >
        <Ionicons name={icon} size={20} color={iconColor} />
        <View style={styles.text}>
          <AppText variant="subtitle" weight="600" color={t.colors.onInverse}>
            {toast.title}
          </AppText>
          {toast.message ? (
            <AppText
              variant="caption"
              color={t.colors.onInverse}
              style={styles.dim}
              numberOfLines={3}
            >
              {toast.message}
            </AppText>
          ) : null}
        </View>
        {toast.action ? (
          <Pressable
            onPress={() => {
              toast.action?.onPress();
              onDismiss();
            }}
            hitSlop={10}
            accessibilityRole="button"
          >
            <AppText
              variant="subtitle"
              weight="600"
              color={t.scheme === 'dark' ? t.colors.primary : '#5EDBC2'}
            >
              {toast.action.label.toUpperCase()}
            </AppText>
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function lightenForInverse(tone: Tone): string {
  switch (tone) {
    case 'success':
      return '#45C98F';
    case 'error':
      return '#FF8A80';
    case 'warning':
      return '#F2B04B';
    default:
      return '#8FD3C5';
  }
}

const styles = StyleSheet.create({
  viewport: { position: 'absolute', left: 12, right: 12, zIndex: 1000, elevation: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  text: { flex: 1, gap: 1 },
  dim: { opacity: 0.8 },
});
