import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { ClayCard } from './ClayCard';
import { IconBadge } from './IconBadge';

const tap = () => Haptics.selectionAsync().catch(() => {});

/* ------------------------------------------------------------------ */
/* SegmentedControl                                                    */
/* ------------------------------------------------------------------ */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  colors,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** Optional per-option active colour */
  colors?: Partial<Record<T, string>>;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.segment,
        {
          backgroundColor: t.colors.surfaceSunken,
          borderRadius: t.radius.md,
          boxShadow: t.shadow('pressed'),
        },
      ]}
    >
      {options.map((o) => {
        const active = o.value === value;
        const activeColor = colors?.[o.value] ?? t.colors.primary;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={[
              styles.segmentItem,
              active && {
                backgroundColor: t.colors.surface,
                borderRadius: t.radius.sm,
                boxShadow: t.shadow('raised'),
              },
            ]}
          >
            <AppText
              variant="caption"
              weight={active ? '700' : '500'}
              color={active ? activeColor : t.colors.textMuted}
              numberOfLines={1}
            >
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Chip                                                                */
/* ------------------------------------------------------------------ */

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
  color?: string;
}) {
  const t = useTheme();
  const c = color ?? t.colors.primary;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress?.();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c + (t.scheme === 'dark' ? '40' : '22') : t.colors.surface,
          borderColor: selected ? c : 'transparent',
          boxShadow: t.shadow(pressed || selected ? 'pressed' : 'raised'),
        },
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={16}
          color={selected ? c : t.colors.textMuted}
        />
      ) : null}
      <AppText
        variant="caption"
        weight={selected ? '700' : '500'}
        color={selected ? t.colors.text : t.colors.textMuted}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* ListRow                                                             */
/* ------------------------------------------------------------------ */

export function ListRow({
  icon,
  iconColor,
  title,
  subtitle,
  right,
  rightSub,
  rightColor,
  onPress,
  chevron = !!onPress,
  muted,
}: {
  icon?: string;
  iconColor?: string;
  title: string;
  subtitle?: string | null;
  right?: string | ReactNode;
  rightSub?: string | null;
  rightColor?: string;
  onPress?: () => void;
  chevron?: boolean;
  muted?: boolean;
}) {
  const t = useTheme();
  const content = (
    <View style={[styles.row, muted && { opacity: 0.55 }]}>
      {icon ? <IconBadge name={icon} color={iconColor ?? t.colors.primary} size={40} /> : null}
      <View style={styles.rowText}>
        <AppText variant="subtitle" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" muted numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right !== undefined ? (
        <View style={styles.rowRight}>
          {typeof right === 'string' ? (
            <AppText variant="subtitle" color={rightColor} numberOfLines={1}>
              {right}
            </AppText>
          ) : (
            right
          )}
          {rightSub ? (
            <AppText variant="caption" muted numberOfLines={1}>
              {rightSub}
            </AppText>
          ) : null}
        </View>
      ) : null}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

/** A card holding ListRows with consistent spacing. */
export function ListCard({ children }: { children: ReactNode }) {
  return <ClayCard style={styles.listCard}>{children}</ClayCard>;
}

/* ------------------------------------------------------------------ */
/* Section header                                                      */
/* ------------------------------------------------------------------ */

export function SectionTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <AppText variant="label" muted>
        {title}
      </AppText>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <AppText variant="caption" weight="700" color={t.colors.primary}>
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* ProgressBar                                                         */
/* ------------------------------------------------------------------ */

export function ProgressBar({
  value,
  color,
  height = 12,
}: {
  /** 0–1 (values above 1 are shown full) */
  value: number;
  color?: string;
  height?: number;
}) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{
        height,
        borderRadius: height,
        backgroundColor: t.colors.surfaceSunken,
        boxShadow: t.shadow('pressed'),
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          borderRadius: height,
          backgroundColor: color ?? t.colors.primary,
        }}
      />
    </View>
  );
}

/** Colour for a budget usage ratio: green < 80% ≤ amber < 100% ≤ red. */
export function useUsageColor(ratio: number): string {
  const { colors } = useTheme();
  if (ratio >= 1) return colors.danger;
  if (ratio >= 0.8) return colors.warning;
  return colors.income;
}

/* ------------------------------------------------------------------ */
/* SwitchRow                                                           */
/* ------------------------------------------------------------------ */

export function SwitchRow({
  title,
  subtitle,
  value,
  onChange,
  icon,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon?: string;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[styles.row, disabled && { opacity: 0.5 }]}>
      {icon ? <IconBadge name={icon} color={t.colors.primary} size={40} /> : null}
      <View style={styles.rowText}>
        <AppText variant="subtitle">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" muted>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: t.colors.primary, false: t.colors.border }}
        thumbColor="#FFFFFF"
        accessibilityLabel={title}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* FAB-style small icon button                                         */
/* ------------------------------------------------------------------ */

export function IconButton({
  icon,
  onPress,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  color?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: t.colors.surface, boxShadow: t.shadow(pressed ? 'pressed' : 'raised') },
      ]}
    >
      <Ionicons name={icon} size={22} color={color ?? t.colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', padding: 4, gap: 4 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  chipRow: { gap: 10, paddingVertical: 6, paddingHorizontal: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  rowText: { flex: 1, gap: 2 },
  rowRight: { alignItems: 'flex-end', gap: 2, maxWidth: '45%' },
  listCard: { gap: 16 },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: -6,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
