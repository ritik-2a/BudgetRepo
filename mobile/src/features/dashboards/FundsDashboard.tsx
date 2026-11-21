import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { LineChart } from '@/components/charts';
import { AppText, ClayButton, ClayCard, ListCard, ListRow, SectionTitle } from '@/components/clay';
import { EmptyState, ErrorState, Skeleton, SkeletonList } from '@/components/feedback';
import { monthRange, ordinal } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

import { useMonthlyTotals } from '../analytics/queries';
import { useFundTotals } from '../funds/repo';

export function FundsDashboard() {
  const t = useTheme();
  const now = useMemo(() => new Date(), []);
  const { start, end } = monthRange(now);
  const fundsQ = useFundTotals(start, end);
  const months = useMonthlyTotals(now, 12);

  const cumulative = useMemo(
    () =>
      months.data.reduce<{ label: string; value: number }[]>(
        (acc, m) => [...acc, { label: m.label, value: (acc.at(-1)?.value ?? 0) + m.invested }],
        [],
      ),
    [months.data],
  );

  if (fundsQ.error) return <ErrorState title="Couldn't load funds" error={fundsQ.error} />;
  if (fundsQ.loading) return <SkeletonList rows={3} />;

  const funds = fundsQ.data;
  const totalInvested = funds.reduce((s, f) => s + f.invested, 0);
  const thisMonth = funds.reduce((s, f) => s + f.investedThisMonth, 0);
  const valued = funds.filter((f) => f.currentValue != null);
  const value = valued.reduce((s, f) => s + (f.currentValue ?? 0), 0);
  const valuedInvested = valued.reduce((s, f) => s + f.invested, 0);
  const sipFunds = funds.filter((f) => f.sipAmount || f.sipDay);
  const sipPlanned = sipFunds.reduce((s, f) => s + (f.sipAmount ?? 0), 0);

  if (funds.length === 0) {
    return (
      <EmptyState
        icon="trending-up"
        title="No mutual funds yet"
        message="Add each fund (and its SIP date) once. Then log investments to see how much you put in every month."
        action={{ label: 'Add fund', onPress: () => router.push('/funds/new') }}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      <ClayCard tint={t.colors.hero} style={styles.hero}>
        <AppText variant="label" color={t.colors.onHeroMuted}>
          Total invested
        </AppText>
        <AppText variant="display" color={t.colors.onHero}>
          {formatINR(totalInvested)}
        </AppText>
        <AppText variant="caption" color={t.colors.onHeroMuted}>
          {formatINR(thisMonth)} this month
          {sipPlanned ? ` · SIPs planned ${formatINR(sipPlanned)}/month` : ''}
        </AppText>
      </ClayCard>

      {valued.length > 0 ? (
        <ClayCard style={styles.gap}>
          <AppText variant="subtitle">Value (from your manual updates)</AppText>
          <View style={styles.row}>
            <AppText variant="title">{formatINR(value)}</AppText>
            <AppText
              variant="subtitle"
              color={value - valuedInvested >= 0 ? t.colors.income : t.colors.danger}
            >
              {formatINR(value - valuedInvested, { signed: true })}
              {valuedInvested > 0
                ? ` (${(((value - valuedInvested) / valuedInvested) * 100).toFixed(1)}%)`
                : ''}
            </AppText>
          </View>
          <AppText variant="caption" muted>
            Covers {valued.length} of {funds.length} funds. Update values on each fund’s page.
          </AppText>
        </ClayCard>
      ) : null}

      {sipFunds.length > 0 ? (
        <>
          <SectionTitle title="SIPs this month" />
          <ListCard>
            {sipFunds.map((f) => {
              const done = f.investedThisMonth > 0;
              return (
                <ListRow
                  key={f.id}
                  icon={done ? 'checkmark-circle' : 'time'}
                  iconColor={done ? t.colors.income : t.colors.warning}
                  title={f.name}
                  subtitle={
                    done
                      ? `Logged ${formatINR(f.investedThisMonth)}`
                      : `${f.sipDay ? `Due on the ${ordinal(f.sipDay)}` : 'Not logged yet'}`
                  }
                  right={f.sipAmount ? formatINR(f.sipAmount) : undefined}
                  onPress={
                    done
                      ? () => router.push({ pathname: '/funds/[id]', params: { id: f.id } })
                      : () =>
                          router.navigate({
                            pathname: '/add',
                            params: {
                              type: 'investment',
                              fundId: f.id,
                              amount: f.sipAmount ? String(f.sipAmount) : undefined,
                            },
                          })
                  }
                />
              );
            })}
          </ListCard>
        </>
      ) : null}

      <SectionTitle title="Total invested · 12 months" />
      <ClayCard>
        {months.loading ? (
          <Skeleton height={170} />
        ) : (
          <LineChart
            data={cumulative}
            color={t.colors.investment}
            accessibilityLabel="Cumulative amount invested over the last twelve months"
          />
        )}
      </ClayCard>

      <SectionTitle title="Funds" action="Add fund" onAction={() => router.push('/funds/new')} />
      <ListCard>
        {funds.map((f) => (
          <ListRow
            key={f.id}
            icon="trending-up"
            iconColor={t.colors.investment}
            title={f.name}
            subtitle={
              f.gain !== null
                ? `Value ${formatINR(f.currentValue!)} · ${formatINR(f.gain, { signed: true })}`
                : f.sipDay
                  ? `SIP on the ${ordinal(f.sipDay)}`
                  : 'Lump sum'
            }
            right={formatINR(f.invested)}
            rightSub="invested"
            onPress={() => router.push({ pathname: '/funds/[id]', params: { id: f.id } })}
          />
        ))}
      </ListCard>
      <ClayButton
        title="Log investment"
        icon="add"
        fullWidth
        onPress={() => router.navigate({ pathname: '/add', params: { type: 'investment' } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  hero: { gap: 6, paddingVertical: 22 },
  dim: { opacity: 0.92 },
  gap: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
