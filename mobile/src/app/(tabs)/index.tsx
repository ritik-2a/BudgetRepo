import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, ClayCard, IconBadge, Screen } from '@/components/clay';
import { EmptyState, ErrorState, Skeleton } from '@/components/feedback';
import { db } from '@/db/client';
import { useLiveData } from '@/db/useLiveData';
import { monthTotalsQuery, toMonthTotals } from '@/features/summary/queries';
import { formatMonth, monthRange } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

export default function HomeScreen() {
  const t = useTheme();
  const now = useMemo(() => new Date(), []);
  const { start, end } = monthRange(now);
  const { data, loading, error } = useLiveData(monthTotalsQuery(db, start, end), [start, end]);
  const totals = toMonthTotals(data);
  const remaining = totals.income - totals.spent - totals.invested;
  const savingsRate =
    totals.income > 0 ? Math.round(((totals.income - totals.spent) / totals.income) * 100) : null;

  if (error) {
    return (
      <Screen title="Overview" subtitle={formatMonth(now)}>
        <ErrorState
          title="Couldn't load this month"
          message="Your totals couldn't be calculated. Switch tabs and come back, or restart the app."
          error={error}
        />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen title="Overview" subtitle={formatMonth(now)}>
        <ClayCard style={styles.hero} accessibilityLabel="Loading totals">
          <Skeleton width="40%" height={12} />
          <Skeleton width="65%" height={34} />
          <Skeleton width="50%" height={12} />
        </ClayCard>
        <View style={styles.tiles}>
          {[0, 1, 2].map((i) => (
            <ClayCard key={i} style={styles.tile}>
              <Skeleton width={34} height={34} radius={12} />
              <Skeleton width="70%" height={12} />
              <Skeleton width="90%" height={16} />
            </ClayCard>
          ))}
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Overview" subtitle={formatMonth(now)}>
      <ClayCard tint={t.colors.primary} style={styles.hero}>
        <AppText variant="label" color={t.colors.onPrimary} style={styles.dim}>
          Left this month
        </AppText>
        <AppText variant="display" color={t.colors.onPrimary}>
          {formatINR(remaining)}
        </AppText>
        <AppText variant="caption" color={t.colors.onPrimary} style={styles.dim}>
          {savingsRate === null
            ? 'Add your salary to see your savings rate'
            : `Savings rate ${savingsRate}%`}
        </AppText>
      </ClayCard>

      <View style={styles.tiles}>
        <StatTile label="Income" value={totals.income} icon="arrow-down" color={t.colors.income} />
        <StatTile label="Spent" value={totals.spent} icon="arrow-up" color={t.colors.expense} />
        <StatTile
          label="Invested"
          value={totals.invested}
          icon="trending-up"
          color={t.colors.investment}
        />
      </View>

      {totals.count === 0 ? (
        <EmptyState
          title="No transactions this month"
          message="Add your salary, a credit-card purchase or today's auto ride. Your totals and savings rate will appear here."
          action={{ label: 'Add transaction', onPress: () => router.navigate('/add') }}
        />
      ) : null}
    </Screen>
  );
}

function StatTile({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <ClayCard style={styles.tile}>
      <IconBadge name={icon} color={color} size={34} />
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText variant="subtitle" numberOfLines={1} adjustsFontSizeToFit>
        {formatINR(value)}
      </AppText>
    </ClayCard>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8, paddingVertical: 24 },
  dim: { opacity: 0.9 },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, gap: 6, padding: 14 },
});
