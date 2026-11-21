import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, ClayButton, ClayCard, IconBadge, ProgressBar } from '@/components/clay';
import { Banner, useToast } from '@/components/feedback';
import { forecastCommute, isOfficeDay, weekDays } from '@/lib/commute';
import { daysBetween, formatDate, toISODate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

import { useAccountBalances } from '../accounts/repo';
import { usePrefs } from '../settings/repo';
import { deleteTransaction } from '../transactions/repo';
import { logMetroTrips, toggleDayOff, useMetroTripsByDay } from './repo';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Home card for the metro commute: card balance → trips / office days left, recharge date,
 * this week's office days (tap to mark WFH/no travel), and one-tap trip logging.
 */
export function CommuteCard() {
  const t = useTheme();
  const toast = useToast();
  const prefs = usePrefs();
  const c = prefs.commute;
  const balances = useAccountBalances();
  const today = useMemo(() => new Date(), []);
  const todayIso = toISODate(today);
  const week = useMemo(() => weekDays(today, c?.workDays ?? [1, 2, 3, 4, 5]), [today, c?.workDays]);
  const trips = useMetroTripsByDay(
    c?.metroAccountId ?? null,
    toISODate(week[0] ?? today),
    toISODate(week[week.length - 1] ?? today),
  );

  if (!c) {
    return (
      <Pressable onPress={() => router.push('/commute')} accessibilityRole="button">
        <Banner
          tone="info"
          title="Set up your metro commute"
          message="See how many trips your metro card has left and when to recharge. Tap to set up."
        />
      </Pressable>
    );
  }

  const card = balances.data.find((a) => a.id === c.metroAccountId);
  if (!card) return null;

  const tripsOn = (iso: string) => trips.data.find((r) => r.date === iso)?.trips ?? 0;
  const todayTrips = tripsOn(todayIso);
  const f = forecastCommute(card.balance, c, today, todayTrips);
  const officeToday = isOfficeDay(today, c);
  const lowColor =
    f.officeDaysLeft <= 2
      ? t.colors.danger
      : f.officeDaysLeft <= 5
        ? t.colors.warning
        : t.colors.income;

  const log = (n: number) => {
    try {
      const ids = logMetroTrips(n, c);
      toast.show('success', {
        title: n === 2 ? 'Round trip logged' : 'Metro trip logged',
        message: `${formatINR(c.fare * n)} from ${card.name}`,
        action: { label: 'Undo', onPress: () => ids.forEach(deleteTransaction) },
      });
    } catch (e) {
      toast.error("Couldn't log the trip", e);
    }
  };

  const toggle = (d: Date) => {
    const iso = toISODate(d);
    if (tripsOn(iso) > 0) {
      toast.info('Already travelled', 'This day has metro trips logged.');
      return;
    }
    const off = toggleDayOff(iso);
    toast.info(off ? `${DAY[d.getDay()]} marked no travel` : `${DAY[d.getDay()]} is an office day`);
  };

  return (
    <ClayCard style={styles.card}>
      <View style={styles.row}>
        <IconBadge name="train" color={t.colors.investment} size={42} />
        <View style={styles.flex}>
          <AppText variant="subtitle">{card.name}</AppText>
          <AppText variant="caption" muted>
            {formatINR(card.balance)} · {f.tripsLeft} trips · {formatINR(c.fare)} each
          </AppText>
        </View>
        <Pressable onPress={() => router.push('/commute')} hitSlop={10} accessibilityRole="button">
          <AppText variant="caption" weight="700" color={t.colors.primary}>
            Edit
          </AppText>
        </Pressable>
      </View>

      <View style={styles.stats}>
        <View style={styles.flex}>
          <AppText variant="display" color={lowColor}>
            {f.officeDaysLeft}
          </AppText>
          <AppText variant="caption" muted>
            office days left
          </AppText>
        </View>
        <View style={[styles.flex, styles.right]}>
          <AppText variant="subtitle">
            {f.rechargeBy ? formatDate(f.rechargeBy).replace(/ \d{4}$/, '') : '90+ days'}
          </AppText>
          <AppText variant="caption" muted>
            {f.rechargeBy
              ? daysBetween(today, f.rechargeBy) <= 0
                ? 'recharge today'
                : 'recharge before'
              : 'no recharge needed soon'}
          </AppText>
        </View>
      </View>
      <ProgressBar value={Math.min(1, f.officeDaysLeft / 10)} color={lowColor} height={8} />

      {/* This week */}
      <View style={styles.week}>
        {week.map((d) => {
          const iso = toISODate(d);
          const done = tripsOn(iso);
          const off = c.overrides[iso] === 'off';
          const isToday = iso === todayIso;
          const past = iso < todayIso;
          const state = done > 0 ? 'done' : off ? 'off' : past ? 'missed' : 'planned';
          const bg =
            state === 'done'
              ? t.colors.income
              : state === 'off'
                ? t.colors.surfaceSunken
                : state === 'missed'
                  ? t.colors.surfaceSunken
                  : t.colors.surface;
          const fg =
            state === 'done' ? '#FFFFFF' : state === 'planned' ? t.colors.text : t.colors.textMuted;
          return (
            <Pressable
              key={iso}
              onPress={() => toggle(d)}
              accessibilityRole="button"
              accessibilityLabel={`${DAY[d.getDay()]} ${d.getDate()}: ${
                state === 'done'
                  ? `${done} trips logged`
                  : state === 'off'
                    ? 'no travel'
                    : 'office day'
              }. Tap to toggle no travel.`}
              style={[
                styles.day,
                {
                  backgroundColor: bg,
                  borderColor: isToday ? t.colors.primary : 'transparent',
                  boxShadow: t.shadow(state === 'planned' ? 'raised' : 'pressed'),
                },
              ]}
            >
              <AppText variant="caption" weight="700" color={fg}>
                {DAY[d.getDay()]}
              </AppText>
              <AppText variant="caption" color={fg}>
                {state === 'done' ? `✓${done}` : state === 'off' ? 'WFH' : d.getDate()}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption" muted>
        Tap a day to mark WFH / no travel. The forecast skips those days.
      </AppText>

      {officeToday && todayTrips < c.tripsPerDay ? (
        <View style={styles.row}>
          <ClayButton
            title={
              todayTrips === 0
                ? `Round trip ${formatINR(c.fare * 2)}`
                : `Return ${formatINR(c.fare)}`
            }
            icon="train"
            onPress={() => log(todayTrips === 0 ? 2 : 1)}
            style={styles.flex}
          />
          {todayTrips === 0 ? (
            <ClayButton title="One way" variant="secondary" onPress={() => log(1)} />
          ) : null}
        </View>
      ) : null}

      {f.shortThisWeek > 0 || f.officeDaysLeft <= 2 ? (
        <ClayButton
          title={`Recharge metro card${f.shortThisWeek > 0 ? ` (need ${formatINR(f.shortThisWeek)} this week)` : ''}`}
          icon="add-circle"
          variant="secondary"
          fullWidth
          onPress={() =>
            router.navigate({
              pathname: '/add',
              params: { type: 'transfer', toAccountId: card.id },
            })
          }
        />
      ) : null}
    </ClayCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end' },
  stats: { flexDirection: 'row', alignItems: 'flex-end' },
  week: { flexDirection: 'row', gap: 8 },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 2,
  },
});
