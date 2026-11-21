import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, ClayButton, ClayCard, IconBadge } from '@/components/clay';
import { useTheme } from '@/theme';

type Action = { label: string; onPress: () => void; icon?: 'add' | 'refresh' | 'arrow-forward' };

/** Friendly "nothing here yet" card with guidance and an optional action. */
export function EmptyState({
  icon = 'sparkles',
  title,
  message,
  action,
  bare,
}: {
  icon?: string;
  title: string;
  message?: string;
  action?: Action;
  /** Render without a card (use when already inside one). */
  bare?: boolean;
}) {
  const t = useTheme();
  const Wrapper = bare ? View : ClayCard;
  return (
    <Wrapper style={bare ? styles.bare : styles.card}>
      <IconBadge name={icon} color={t.colors.primary} size={48} />
      <AppText variant="subtitle" style={styles.center}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="caption" muted style={styles.center}>
          {message}
        </AppText>
      ) : null}
      {action ? (
        <ClayButton
          title={action.label}
          icon={action.icon ?? 'add'}
          onPress={action.onPress}
          style={styles.action}
        />
      ) : null}
    </Wrapper>
  );
}

/** Card explaining what went wrong, with the real error text and a retry button. */
export function ErrorState({
  title = 'Something went wrong',
  message,
  error,
  onRetry,
}: {
  title?: string;
  message?: string;
  error?: unknown;
  onRetry?: () => void;
}) {
  const t = useTheme();
  const details = errorMessage(error);
  return (
    <ClayCard style={styles.card} accessibilityRole="alert">
      <IconBadge name="alert-circle" color={t.colors.danger} size={56} />
      <AppText variant="subtitle" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="caption" muted style={styles.center}>
        {message ?? 'Please try again. If it keeps happening, restart the app.'}
      </AppText>
      {details ? (
        <View style={[styles.details, { backgroundColor: t.colors.surfaceSunken }]}>
          <AppText variant="caption" color={t.colors.danger} selectable>
            {details}
          </AppText>
        </View>
      ) : null}
      {onRetry ? (
        <ClayButton title="Try again" icon="refresh" onPress={onRetry} style={styles.action} />
      ) : null}
    </ClayCard>
  );
}

/** Full-screen version of ErrorState (used before the app shell is ready). */
export function FullScreenError(props: Parameters<typeof ErrorState>[0]) {
  const t = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: t.colors.background }}
      contentContainerStyle={styles.full}
    >
      <ErrorState {...props} />
    </ScrollView>
  );
}

/** Turns any thrown value into readable text. */
export function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  bare: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  center: { textAlign: 'center', maxWidth: 300 },
  action: { alignSelf: 'center', marginTop: 6 },
  details: { alignSelf: 'stretch', padding: 12, borderRadius: 12 },
  full: { flexGrow: 1, justifyContent: 'center', padding: 24 },
});
