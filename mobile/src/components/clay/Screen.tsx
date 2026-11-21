import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { AppText } from './AppText';

/** Height reserved at the bottom so content isn't hidden behind the floating tab bar. */
export const TAB_BAR_SPACE = 110;

export type ScreenProps = {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  /** Show a back button (stack screens outside the tab bar). */
  back?: boolean;
  /** Stack screens have no tab bar, so need less bottom padding. */
  inTabs?: boolean;
  /** Pinned at the bottom (e.g. Save button). */
  footer?: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
};

export function Screen({
  title,
  subtitle,
  right,
  children,
  scroll = true,
  back,
  inTabs = !back,
  footer,
  refreshControl,
}: ScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const header =
    title || back ? (
      <View style={styles.header}>
        {back ? (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            style={({ pressed }) => [
              styles.back,
              {
                backgroundColor: t.colors.surface,
                boxShadow: t.shadow(pressed ? 'pressed' : 'raised'),
              },
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={t.colors.text} />
          </Pressable>
        ) : null}
        <View style={styles.headerText}>
          {subtitle ? (
            <AppText variant="label" muted>
              {subtitle}
            </AppText>
          ) : null}
          {title ? (
            <AppText
              variant={back ? 'title' : 'display'}
              accessibilityRole="header"
              numberOfLines={1}
            >
              {title}
            </AppText>
          ) : null}
        </View>
        {right}
      </View>
    ) : null;

  const bottomPad = (inTabs ? TAB_BAR_SPACE : t.spacing.xl) + insets.bottom;
  const contentStyle = {
    paddingTop: insets.top + t.spacing.lg,
    paddingHorizontal: t.spacing.lg,
    paddingBottom: footer ? t.spacing.lg : bottomPad,
    gap: t.spacing.lg,
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: t.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={contentStyle}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, contentStyle]}>
          {header}
          {children}
        </View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: (inTabs ? TAB_BAR_SPACE : t.spacing.md) + insets.bottom,
              backgroundColor: t.colors.background,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { gap: 2, flex: 1 },
  back: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
});
