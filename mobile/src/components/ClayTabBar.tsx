import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText, type IconName } from './clay';

const ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: 'home', inactive: 'home-outline' },
  transactions: { active: 'receipt', inactive: 'receipt-outline' },
  add: { active: 'add', inactive: 'add' },
  insights: { active: 'stats-chart', inactive: 'stats-chart-outline' },
  settings: { active: 'settings', inactive: 'settings-outline' },
};

/** Docked bottom tab bar with a centre "Add" button. Sits in the layout (no overlap). */
export function ClayTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  const t = useTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: t.colors.surface,
          borderTopColor: t.colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = index === state.index;
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const icons = ICONS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };

        const onPress = () => {
          Haptics.selectionAsync().catch(() => {});
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };

        if (route.name === 'add') {
          return (
            <View key={route.key} style={styles.item}>
              <Pressable
                onPress={onPress}
                android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
                accessibilityRole="button"
                accessibilityLabel="Add transaction"
                style={[styles.addButton, { backgroundColor: t.colors.primary }]}
              >
                <Ionicons name="add" size={28} color={t.colors.onPrimary} />
              </Pressable>
            </View>
          );
        }

        const color = focused ? t.colors.primary : t.colors.textMuted;
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            android_ripple={{ color: t.colors.ripple, borderless: true, radius: 36 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            style={styles.item}
          >
            <Ionicons name={focused ? icons.active : icons.inactive} size={22} color={color} />
            <AppText
              variant="caption"
              color={color}
              weight={focused ? '600' : '500'}
              style={styles.label}
            >
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 48 },
  label: { fontSize: 11, lineHeight: 14 },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
