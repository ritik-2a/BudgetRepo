import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart, HBarList } from '@/components/charts';
import { AppText, ClayCard, MonthSwitcher, SectionTitle } from '@/components/clay';
import { EmptyState, ErrorState, Skeleton } from '@/components/feedback';
import { daysBetween, fromISODate, monthRange } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

import { useCategoryTrend, useChildSpend } from '../analytics/queries';
import { QuickTravel } from '../transactions/QuickTravel';

const TRAVEL = 'Travel';

export function TravelDashboard() {
  const t = useTheme();
  const [month, setMonth] = useState(() => new Date());
  const { start, end } = monthRange(month);
  const spend = useChildSpend(TRAVEL, start, end);
  const trend = useCategoryTrend(TRAVEL, month, 6);

  const total = spend.data.reduce((s, c) => s + c.total, 0);
  const trips = spend.data.reduce((s, c) => s + c.count, 0);
  const now = new Date();
  const isCurrent =
    month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear();
  const days = isCurrent ? now.getDate() : daysBetween(fromISODate(start), fromISODate(end)) + 1;

  return (
    <View style={styles.wrap}>
      <MonthSwitcher month={month} onChange={setMonth} />
      {spend.error ? <ErrorState title="Couldn't load travel" error={spend.error} /> : null}

      <ClayCard tint={t.colors.hero} style={styles.hero}>
        <AppText variant="label" color={t.colors.onHeroMuted}>
          Travel this month
        </AppText>
        <AppText variant="display" color={t.colors.onHero}>
          {formatINR(total)}
        </AppText>
        <AppText variant="caption" color={t.colors.onHeroMuted}>
          {trips} trip{trips === 1 ? '' : 's'} · about{' '}
          {formatINR(Math.round(total / Math.max(1, days)))} a day
        </AppText>
      </ClayCard>

      {isCurrent ? <QuickTravel /> : null}

      <SectionTitle title="By mode" />
      <ClayCard>
        {spend.loading ? (
          <Skeleton height={120} />
        ) : spend.data.length === 0 ? (
          <EmptyState
            bare
            icon="train"
            title="No travel logged"
            message="Use the Auto and Metro buttons to log rides in one tap."
            action={{
              label: 'Add travel',
              onPress: () => router.navigate({ pathname: '/add', params: { type: 'expense' } }),
            }}
          />
        ) : (
          <HBarList
            items={[...spend.data]
              .sort((a, b) => b.total - a.total)
              .map((c) => ({
                key: c.id,
                label: c.name,
                value: c.total,
                color: c.color,
                sub: `${c.count} trip${c.count === 1 ? '' : 's'} · avg ${formatINR(Math.round(c.total / c.count))}`,
              }))}
          />
        )}
      </ClayCard>

      <SectionTitle title="Travel · last 6 months" />
      <ClayCard>
        {trend.loading ? (
          <Skeleton height={180} />
        ) : (
          <BarChart
            data={trend.data}
            color={t.colors.travel}
            accessibilityLabel="Monthly travel spending for the last six months"
          />
        )}
      </ClayCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  hero: { gap: 6, paddingVertical: 22 },
  dim: { opacity: 0.92 },
});
