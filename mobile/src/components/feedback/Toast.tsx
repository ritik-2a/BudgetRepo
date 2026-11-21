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
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
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
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (tone: Tone, opts: ToastOptions) => {
      const id = nextId.current++;
      setToasts((list) => [...list, { ...opts, id, tone }].slice(-MAX_VISIBLE));

      const feedback =
        tone === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : tone === 'error'
            ? Haptics.NotificationFeedbackType.Error
            : Haptics.NotificationFeedbackType.Warning;
      Haptics.notificationAsync(feedback).catch(() => {});
      AccessibilityInfo.announceForAccessibility(
        [opts.title, opts.message].filter(Boolean).join('. '),
      );

      const duration = opts.duration ?? (tone === 'error' ? 6000 : 3500);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
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
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.viewport, { top: insets.top + 8 }]}>
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </View>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const t = useTheme();
  const { color, icon } = useToneColors(toast.tone);

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(18)}
      exiting={FadeOutUp.duration(200)}
      layout={LinearTransition}
    >
      <Pressable
        onPress={onDismiss}
        accessibilityRole={toast.tone === 'error' ? 'alert' : 'button'}
        accessibilityHint="Tap to dismiss"
        style={[
          styles.card,
          {
            backgroundColor: t.colors.surface,
            borderRadius: t.radius.md,
            boxShadow: t.shadow('raised'),
            borderLeftColor: color,
          },
        ]}
      >
        <Ionicons name={icon} size={24} color={color} />
        <View style={styles.text}>
          <AppText variant="subtitle">{toast.title}</AppText>
          {toast.message ? (
            <AppText variant="caption" muted numberOfLines={4}>
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
            hitSlop={8}
            accessibilityRole="button"
          >
            <AppText variant="subtitle" color={t.colors.primary}>
              {toast.action.label}
            </AppText>
          </Pressable>
        ) : (
          <Ionicons name="close" size={18} color={t.colors.textMuted} />
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: { position: 'absolute', left: 12, right: 12, gap: 8, zIndex: 1000, elevation: 1000 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderLeftWidth: 5,
  },
  text: { flex: 1, gap: 2 },
});
