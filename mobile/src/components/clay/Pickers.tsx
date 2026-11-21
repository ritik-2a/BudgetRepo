import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { addMonths, formatDate, formatMonth, fromISODate, toISODate } from '@/lib/dates';
import { useTheme } from '@/theme';

import { AppText } from './AppText';
import { ClayButton } from './ClayButton';
import { ClayCard } from './ClayCard';

/* ------------------------------------------------------------------ */
/* Field shell                                                         */
/* ------------------------------------------------------------------ */

function FieldButton({
  label,
  value,
  icon,
  onPress,
  error,
}: {
  label?: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  error?: string;
}) {
  const t = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="label" muted>
          {label}
        </AppText>
      ) : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? ''} ${value}`}
        style={[
          styles.field,
          {
            backgroundColor: t.colors.surfaceSunken,
            borderRadius: t.radius.md,
            boxShadow: t.shadow('pressed'),
            borderColor: error ? t.colors.danger : 'transparent',
          },
        ]}
      >
        <Ionicons name={icon} size={18} color={t.colors.primary} />
        <AppText variant="body" style={styles.flex}>
          {value}
        </AppText>
        <Ionicons name="chevron-down" size={16} color={t.colors.textMuted} />
      </Pressable>
      {error ? (
        <AppText variant="caption" color={t.colors.danger}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* iOS picker sheet (Android uses the native dialog)                   */
/* ------------------------------------------------------------------ */

function IOSPickerModal({
  visible,
  mode,
  value,
  onDone,
  onCancel,
  maximumDate,
}: {
  visible: boolean;
  mode: 'date' | 'time';
  value: Date;
  onDone: (d: Date) => void;
  onCancel: () => void;
  maximumDate?: Date;
}) {
  const t = useTheme();
  const [temp, setTemp] = useState(value);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable onPress={() => {}}>
          <ClayCard style={styles.sheet}>
            <DateTimePicker
              value={temp}
              mode={mode}
              display={mode === 'date' ? 'inline' : 'spinner'}
              maximumDate={maximumDate}
              onValueChange={(_, d) => setTemp(d)}
              themeVariant={t.scheme}
              accentColor={t.colors.primary}
            />
            <View style={styles.sheetButtons}>
              <ClayButton title="Cancel" variant="secondary" onPress={onCancel} />
              <ClayButton title="Done" onPress={() => onDone(temp)} />
            </View>
          </ClayCard>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* DateField                                                           */
/* ------------------------------------------------------------------ */

export function DateField({
  label = 'Date',
  value,
  onChange,
  error,
  allowFuture = false,
}: {
  label?: string;
  /** "YYYY-MM-DD" */
  value: string;
  onChange: (iso: string) => void;
  error?: string;
  allowFuture?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const date = fromISODate(value);
  const maximumDate = allowFuture ? undefined : new Date();

  const show = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'date',
        maximumDate,
        onValueChange: (_, d) => onChange(toISODate(d)),
      });
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <FieldButton
        label={label}
        value={formatDate(value)}
        icon="calendar"
        onPress={show}
        error={error}
      />
      {Platform.OS === 'ios' && open ? (
        <IOSPickerModal
          visible
          mode="date"
          value={date}
          maximumDate={maximumDate}
          onCancel={() => setOpen(false)}
          onDone={(d) => {
            setOpen(false);
            onChange(toISODate(d));
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* TimeField                                                           */
/* ------------------------------------------------------------------ */

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function TimeField({
  label = 'Time',
  value,
  onChange,
}: {
  label?: string;
  /** "HH:mm" */
  value: string;
  onChange: (hhmm: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [h, m] = value.split(':').map(Number);
  const date = new Date(2000, 0, 1, h, m);
  const emit = (d: Date) =>
    onChange(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);

  const show = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: date, mode: 'time', onValueChange: (_, d) => emit(d) });
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <FieldButton label={label} value={formatTime(value)} icon="time" onPress={show} />
      {Platform.OS === 'ios' && open ? (
        <IOSPickerModal
          visible
          mode="time"
          value={date}
          onCancel={() => setOpen(false)}
          onDone={(d) => {
            setOpen(false);
            emit(d);
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* MonthSwitcher                                                       */
/* ------------------------------------------------------------------ */

export function MonthSwitcher({
  month,
  onChange,
}: {
  /** Any date inside the month */
  month: Date;
  onChange: (d: Date) => void;
}) {
  const t = useTheme();
  const now = new Date();
  const isCurrent =
    month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const btn = (icon: 'chevron-back' | 'chevron-forward', delta: number, disabled = false) => (
    <Pressable
      disabled={disabled}
      onPress={() => onChange(addMonths(month, delta))}
      accessibilityRole="button"
      accessibilityLabel={delta < 0 ? 'Previous month' : 'Next month'}
      hitSlop={8}
      style={({ pressed }) => [
        styles.monthBtn,
        {
          backgroundColor: t.colors.surface,
          boxShadow: t.shadow(pressed ? 'pressed' : 'raised'),
          opacity: disabled ? 0.35 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={t.colors.text} />
    </Pressable>
  );
  return (
    <View style={styles.monthRow}>
      {btn('chevron-back', -1)}
      <Pressable
        onPress={() => onChange(new Date(now.getFullYear(), now.getMonth(), 1))}
        accessibilityRole="button"
        accessibilityHint="Jump to the current month"
        style={styles.flexCenter}
      >
        <AppText variant="subtitle">{formatMonth(month)}</AppText>
        {!isCurrent ? (
          <AppText variant="caption" color={t.colors.primary}>
            Back to this month
          </AppText>
        ) : null}
      </Pressable>
      {btn('chevron-forward', 1, isCurrent)}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* DayPicker (1–31) for statement/due/SIP days                         */
/* ------------------------------------------------------------------ */

export function DayPicker({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: number | null;
  onChange: (day: number) => void;
  error?: string;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <FieldButton
        label={label}
        value={value ? `Day ${value} of the month` : 'Choose a day'}
        icon="calendar-number"
        onPress={() => setOpen(true)}
        error={error}
      />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable onPress={() => {}}>
            <ClayCard style={styles.sheet}>
              <AppText variant="subtitle">{label}</AppText>
              <View style={styles.dayGrid}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                  const active = d === value;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => {
                        onChange(d);
                        setOpen(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Day ${d}`}
                      style={[
                        styles.day,
                        {
                          backgroundColor: active ? t.colors.primary : t.colors.surfaceSunken,
                        },
                      ]}
                    >
                      <AppText
                        variant="caption"
                        weight="700"
                        color={active ? t.colors.onPrimary : t.colors.text}
                      >
                        {d}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
              <AppText variant="caption" muted>
                Days 29–31 automatically move to the last day in shorter months.
              </AppText>
            </ClayCard>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    minHeight: 50,
    borderWidth: 1.5,
  },
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 12, 25, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: { gap: 14 },
  sheetButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  monthBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexCenter: { flex: 1, alignItems: 'center' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  day: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
