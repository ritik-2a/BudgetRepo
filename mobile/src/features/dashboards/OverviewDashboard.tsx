import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart, DonutChart } from '@/components/charts';
import {
  AppText,
  ClayCard,
  ListCard,
  ListRow,
  MonthSwitcher,
  ProgressBar,
  SectionTitle,
} from '@/components/clay';
import { EmptyState, ErrorState, Skeleton } from '@/components/feedback';
import { monthRange } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

import { useMonthlyTotals, useSpendByCategory } from '../analytics/queries';
import { useBudgetStatus } from '../budgets/repo';

export function OverviewDashboard() {
  const t = useTheme();
  const [month, setMonth] = useState(() => new Date());
  const { start, end } = monthRange(month);
  const months = useMonthlyTotals(month, 6);
  const byCat = useSpendByCategory(start, end);
  const budget = useBudgetStatus(month);

  const current = months.data[months.data.length - 1];
  const error = months.error ?? byCat.error;

  return (
    <View style={styles.wrap}>
      <MonthSwitcher month={month} onChange={setMonth} />
      {error ? <ErrorState title="Couldn't load insights" error={error} /> : null}

      <ClayCard style={styles.cols}>
        {months.loading ? (
          <Skeleton height={44} />
        ) : (
          <>
            <Stat label="Income" value={current?.income ?? 0} color={t.colors.income} />
            <Stat label="Spent" value={current?.spent ?? 0} color={t.colors.expense} />
            <Stat label="Invested" value={current?.invested ?? 0} color={t.colors.investment} />
          </>
        )}
      </ClayCard>
      {current && current.income > 0 ? (
        <ClayCard style={styles.gap}>
          <View style={styles.row}>
            <AppText variant="subtitle">Savings rate</AppText>
            <AppText variant="subtitle">
              {Math.round(((current.income - current.spent) / current.income) * 100)}%
            </AppText>
          </View>
          <ProgressBar
            value={Math.max(0, (current.income - current.spent) / current.income)}
            color={t.colors.income}
          />
          <AppText variant="caption" muted>
            Of {formatINR(current.income)} earned, {formatINR(current.spent)} was spent and{' '}
            {formatINR(current.invested)} invested.
          </AppText>
        </ClayCard>
      ) : null}

      <SectionTitle title="Where the money went" />
      <ClayCard>
        {byCat.loading ? (
          <Skeleton height={190} />
        ) : byCat.data.length === 0 ? (
          <EmptyState
            icon="pie-chart"
            title="No spending this month"
            message="Add expenses to see the category breakdown."
          />
        ) : (
          <DonutChart
            centerLabel="Spent"
            segments={byCat.data.map((c) => ({
              key: c.id,
              label: c.name,
              value: c.total,
              color: c.color,
            }))}
          />
        )}
      </ClayCard>

      <SectionTitle title="Spending · last 6 months" />
      <ClayCard>
        {months.loading ? (
          <Skeleton height={180} />
        ) : (
          <BarChart
            data={months.data.map((m) => ({ label: m.label, value: m.spent }))}
            color={t.colors.expense}
            accessibilityLabel="Monthly spending for the last six months"
          />
        )}
      </ClayCard>

      <SectionTitle title="Budgets" action="Manage" onAction={() => router.push('/budgets')} />
      {budget.data.overall || budget.data.lines.length ? (
        <ListCard>
          {[budget.data.overall, ...budget.data.lines.slice(0, 5)]
            .filter((l) => l !== null)
            .map((l) => (
              <BudgetMini
                key={l.budget.id}
                name={l.category?.name ?? 'Overall'}
                spent={l.spent}
                limit={l.budget.limitAmount}
                ratio={l.ratio}
              />
            ))}
        </ListCard>
      ) : (
        <ListCard>
          <ListRow
            icon="speedometer"
            title="Set monthly budgets"
            subtitle="Get alerts at 80% and 100% of a limit"
            onPress={() => router.push('/budgets')}
          />
        </ListCard>
      )}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText variant="subtitle" numberOfLines={1} adjustsFontSizeToFit>
        {formatINR(value)}
      </AppText>
    </View>
  );
}

export function BudgetMini({
  name,
  spent,
  limit,
  ratio,
}: {
  name: string;
  spent: number;
  limit: number;
  ratio: number;
}) {
  const t = useTheme();
  const color = ratio >= 1 ? t.colors.danger : ratio >= 0.8 ? t.colors.warning : t.colors.income;
  return (
    <View style={styles.gapSm}>
      <View style={styles.row}>
        <AppText variant="subtitle">{name}</AppText>
        <AppText variant="caption" muted>
          {formatINR(spent)} / {formatINR(limit)}
        </AppText>
      </View>
      <ProgressBar value={ratio} color={color} height={10} />
      <AppText variant="caption" color={ratio >= 0.8 ? color : t.colors.textMuted}>
        {ratio >= 1
          ? `Over by ${formatINR(spent - limit)}`
          : `${formatINR(limit - spent)} left · ${Math.round(ratio * 100)}% used`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  cols: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  gap: { gap: 10 },
  gapSm: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
