import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, ClayCard, IconBadge, ListCard, Screen, SectionTitle } from '@/components/clay';
import { Banner, EmptyState, ErrorState, SkeletonList } from '@/components/feedback';
import { useBudgetStatus } from '@/features/budgets/repo';
import { CommuteCard } from '@/features/commute/CommuteCard';
import { MoneyOverview } from '@/features/accounts/MoneyOverview';
import { DueReminders } from '@/features/recurring/DueReminders';
import { PeopleSummary } from '@/features/split/PeopleSummary';
import { QuickTravel } from '@/features/transactions/QuickTravel';
import { totalsQuery, useTransactions } from '@/features/transactions/repo';
import { TxListItem } from '@/features/transactions/TxListItem';
import { useLiveData } from '@/db/useLiveData';
import { toMonthTotals } from '@/features/summary/queries';
import { formatMonth, monthRange } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

export default function HomeScreen() {
  const t = useTheme();
  const now = useMemo(() => new Date(), []);
  const { start, end } = monthRange(now);
  const totalsQ = useLiveData<{ type: string; total: number; count: number }>(
    totalsQuery(start, end),
    [start, end],
  );
  const totals = toMonthTotals(totalsQ.data);
  const recent = useTransactions({ start: '0000-01-01', end: '9999-12-31', limit: 6 });
  const budget = useBudgetStatus(now);

  const hot = [budget.data.overall, ...budget.data.lines].filter(
    (l): l is NonNullable<typeof l> => !!l && l.ratio >= 0.8,
  );

  const greeting =
    now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen title="Overview" subtitle={`${greeting} · ${formatMonth(now)}`}>
      <MoneyOverview />

      <SectionTitle title={`This month · ${formatMonth(now)}`} />
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

      {/* Due items (salary etc.) and alerts */}
      <DueReminders />
      <PeopleSummary />
      {hot.slice(0, 2).map((l) => (
        <Pressable
          key={l.budget.id}
          onPress={() => router.push('/budgets')}
          accessibilityRole="button"
        >
          <Banner
            tone={l.ratio >= 1 ? 'error' : 'warning'}
            title={
              l.ratio >= 1
                ? `${l.category?.name ?? 'Monthly'} budget exceeded`
                : `${l.category?.name ?? 'Monthly'} budget at ${Math.round(l.ratio * 100)}%`
            }
            message={
              l.ratio >= 1
                ? `Over by ${formatINR(l.spent - l.budget.limitAmount)}.`
                : `${formatINR(l.remaining)} left for the rest of the month.`
            }
          />
        </Pressable>
      ))}

      <SectionTitle title="Commute" />
      <CommuteCard />
      <QuickTravel />

      <SectionTitle title="Shortcuts" />
      <View style={styles.shortcuts}>
        <Shortcut
          icon="card"
          label="Card"
          color={t.colors.creditCard}
          onPress={() => router.navigate({ pathname: '/insights', params: { tab: 'card' } })}
        />
        <Shortcut
          icon="trending-up"
          label="Funds"
          color={t.colors.investment}
          onPress={() => router.push('/funds')}
        />
        <Shortcut
          icon="speedometer"
          label="Budgets"
          color={t.colors.warning}
          onPress={() => router.push('/budgets')}
        />
        <Shortcut
          icon="flag"
          label="Goals"
          color={t.colors.income}
          onPress={() => router.push('/goals')}
        />
      </View>

      <SectionTitle
        title="Recent"
        action={recent.data.length ? 'See all' : undefined}
        onAction={() => router.navigate('/transactions')}
      />
      {recent.error ? (
        <ErrorState title="Couldn't load recent transactions" error={recent.error} />
      ) : recent.loading ? (
        <SkeletonList rows={3} />
      ) : recent.data.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          message="Add your salary, a credit-card purchase or today's auto ride. Your totals and savings rate will appear here."
          action={{ label: 'Add transaction', onPress: () => router.navigate('/add') }}
        />
      ) : (
        <ListCard>
          {recent.data.map((tx) => (
            <TxListItem key={tx.id} tx={tx} showDate />
          ))}
        </ListCard>
      )}
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

function Shortcut({
  icon,
  label,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: t.colors.ripple }}
      style={[styles.shortcut, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}
    >
      <IconBadge name={icon} color={color} size={38} />
      <AppText variant="caption" weight="600">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, gap: 6, padding: 14 },
  shortcuts: { flexDirection: 'row', gap: 10 },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
