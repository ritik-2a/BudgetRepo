import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, ClayCard, IconBadge, ListCard, Screen, SectionTitle } from '@/components/clay';
import { Banner, EmptyState, ErrorState, Skeleton, SkeletonList } from '@/components/feedback';
import { useAccountBalances, type AccountWithBalance } from '@/features/accounts/repo';
import { useCardActivity } from '@/features/analytics/queries';
import { useBudgetStatus } from '@/features/budgets/repo';
import { CommuteCard } from '@/features/commute/CommuteCard';
import { DueReminders } from '@/features/recurring/DueReminders';
import { QuickTravel } from '@/features/transactions/QuickTravel';
import { totalsQuery, useTransactions } from '@/features/transactions/repo';
import { TxListItem } from '@/features/transactions/TxListItem';
import { useLiveData } from '@/db/useLiveData';
import { toMonthTotals } from '@/features/summary/queries';
import { getCardCycle } from '@/lib/billing-cycle';
import { cardStatement } from '@/lib/commute';
import { formatDate, formatMonth, monthRange } from '@/lib/dates';
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
  const balances = useAccountBalances();
  const cards = balances.data.filter((a) => a.type === 'credit_card' && a.statementDay && a.dueDay);

  const remaining = totals.income - totals.spent - totals.invested;
  const savingsRate =
    totals.income > 0 ? Math.round(((totals.income - totals.spent) / totals.income) * 100) : null;
  const hot = [budget.data.overall, ...budget.data.lines].filter(
    (l): l is NonNullable<typeof l> => !!l && l.ratio >= 0.8,
  );

  const greeting =
    now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen title="Overview" subtitle={`${greeting} · ${formatMonth(now)}`}>
      {totalsQ.error ? (
        <ErrorState title="Couldn't load this month" error={totalsQ.error} />
      ) : totalsQ.loading ? (
        <ClayCard style={styles.hero}>
          <Skeleton width="40%" height={12} />
          <Skeleton width="65%" height={34} />
          <Skeleton width="50%" height={12} />
        </ClayCard>
      ) : (
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
              : `Savings rate ${savingsRate}% · after spending and investing`}
          </AppText>
        </ClayCard>
      )}

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
      {cards.map((c) => (
        <CardDueAlert key={c.id} card={c} />
      ))}
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

function CardDueAlert({ card }: { card: AccountWithBalance }) {
  const cycle = getCardCycle(card.statementDay!, card.dueDay!);
  const act = useCardActivity(card.id, cycle.lastEnd);
  const a = act.row;
  if (!a) return null;
  const due = cardStatement({
    opening: card.openingBalance,
    spendToStatement: a.spendToStatement,
    creditsToStatement: a.creditsToStatement,
    paidAfterStatement: a.paidAfterStatement,
  }).dueRemaining;
  if (due === 0 || cycle.daysToDue > 5) return null;
  const overdue = cycle.daysToDue < 0;
  return (
    <Pressable
      onPress={() =>
        router.navigate({
          pathname: '/add',
          params: { type: 'transfer', toAccountId: card.id, amount: String(due) },
        })
      }
      accessibilityRole="button"
      accessibilityHint="Log the bill payment"
    >
      <Banner
        tone={overdue || cycle.daysToDue <= 1 ? 'error' : 'warning'}
        title={
          overdue
            ? `${card.name} bill overdue`
            : cycle.daysToDue === 0
              ? `${card.name} bill due today`
              : `${card.name} bill due in ${cycle.daysToDue} days`
        }
        message={`${formatINR(due)} to pay by ${formatDate(cycle.dueDate)}. Tap to log the payment.`}
      />
    </Pressable>
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
      style={({ pressed }) => [
        styles.shortcut,
        { backgroundColor: t.colors.surface, boxShadow: t.shadow(pressed ? 'pressed' : 'raised') },
      ]}
    >
      <IconBadge name={icon} color={color} size={38} />
      <AppText variant="caption" weight="600">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8, paddingVertical: 24 },
  dim: { opacity: 0.9 },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, gap: 6, padding: 14 },
  shortcuts: { flexDirection: 'row', gap: 10 },
  shortcut: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 18 },
});
