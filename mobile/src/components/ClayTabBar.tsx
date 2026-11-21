import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText, type IconName } from './clay';

const ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: 'home', inactive: 'home-outline' },
  transactions: { active: 'list', inactive: 'list-outline' },
  add: { active: 'add', inactive: 'add' },
  insights: { active: 'pie-chart', inactive: 'pie-chart-outline' },
  settings: { active: 'settings', inactive: 'settings-outline' },
};

/** Floating clay tab bar with a raised centre "Add" button. */
export function ClayTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  const t = useTheme();

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <View
        style={[
          styles.bar,
          {
            backgroundColor: t.colors.surface,
            borderRadius: t.radius.lg,
            boxShadow: t.shadow('raised'),
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = index === state.index;
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const icons = ICONS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };
          const isAdd = route.name === 'add';

          const onPress = () => {
            Haptics.selectionAsync().catch(() => {});
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };

          if (isAdd) {
            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel="Add transaction"
                style={({ pressed }) => [
                  styles.addButton,
                  {
                    backgroundColor: t.colors.primary,
                    boxShadow: t.shadow(pressed ? 'pressed' : 'raised'),
                    transform: [{ scale: pressed ? 0.94 : 1 }],
                  },
                ]}
              >
                <Ionicons name="add" size={32} color={t.colors.onPrimary} />
              </Pressable>
            );
          }

          const color = focused ? t.colors.primary : t.colors.textMuted;
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={styles.item}
            >
              <View
                style={[
                  styles.iconPill,
                  focused && {
                    backgroundColor: t.colors.surfaceSunken,
                    boxShadow: t.shadow('pressed'),
                  },
                ]}
              >
                <Ionicons name={focused ? icons.active : icons.inactive} size={22} color={color} />
              </View>
              <AppText
                variant="caption"
                color={color}
                weight={focused ? '700' : '500'}
                style={styles.label}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  iconPill: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 14 },
  label: { fontSize: 11 },
  addButton: {
    width: 60,
    height: 60,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    marginHorizontal: 4,
  },
});
