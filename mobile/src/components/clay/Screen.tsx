import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
};

export function Screen({ title, subtitle, right, children, scroll = true }: ScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const header = title ? (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {subtitle ? (
          <AppText variant="label" muted>
            {subtitle}
          </AppText>
        ) : null}
        <AppText variant="display" accessibilityRole="header">
          {title}
        </AppText>
      </View>
      {right}
    </View>
  ) : null;

  const contentStyle = {
    paddingTop: insets.top + t.spacing.lg,
    paddingHorizontal: t.spacing.lg,
    paddingBottom: TAB_BAR_SPACE + insets.bottom,
    gap: t.spacing.lg,
  };

  return (
    <View style={[styles.root, { backgroundColor: t.colors.background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={contentStyle} showsVerticalScrollIndicator={false}>
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, contentStyle]}>
          {header}
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  headerText: { gap: 2, flexShrink: 1 },
});
