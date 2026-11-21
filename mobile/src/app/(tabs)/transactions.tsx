import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Chip,
  ChipRow,
  ClayCard,
  ClayInput,
  MonthSwitcher,
  TAB_BAR_SPACE,
} from '@/components/clay';
import { StatusBarScrim } from '@/components/clay/StatusBarScrim';
import { EmptyState, ErrorState, SkeletonList } from '@/components/feedback';
import type { TransactionType } from '@/db/schema';
import { useAccounts } from '@/features/accounts/repo';
import { useTransactions, type TxRow } from '@/features/transactions/repo';
import { TxListItem } from '@/features/transactions/TxListItem';
import { formatDayHeader, monthRange } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

const TYPE_FILTERS: { value: TransactionType | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: 'apps' },
  { value: 'expense', label: 'Expenses', icon: 'arrow-up' },
  { value: 'income', label: 'Income', icon: 'arrow-down' },
  { value: 'investment', label: 'Investments', icon: 'trending-up' },
  { value: 'transfer', label: 'Transfers', icon: 'swap-horizontal' },
];

export default function HistoryScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => new Date());
  const [type, setType] = useState<TransactionType | 'all'>('all');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { start, end } = monthRange(month);
  const accountsQ = useAccounts();
  const { data, loading, error } = useTransactions({ start, end, type, accountId, search });

  const sections = useMemo(() => {
    const map = new Map<string, TxRow[]>();
    for (const tx of data) {
      const list = map.get(tx.date) ?? [];
      list.push(tx);
      map.set(tx.date, list);
    }
    return [...map.entries()].map(([date, items]) => ({
      date,
      data: items,
      spent: items.filter((i) => i.type === 'expense').reduce((s, i) => s + i.amount, 0),
    }));
  }, [data]);

  const totals = useMemo(() => {
    let spent = 0;
    let income = 0;
    let invested = 0;
    for (const tx of data) {
      if (tx.type === 'expense') spent += tx.amount;
      else if (tx.type === 'income') income += tx.amount;
      else if (tx.type === 'investment') invested += tx.amount;
    }
    return { spent, income, invested };
  }, [data]);

  const filtered = type !== 'all' || !!accountId || !!search.trim();

  const header = (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <AppText variant="label" muted>
          All transactions
        </AppText>
        <AppText variant="display" accessibilityRole="header">
          History
        </AppText>
      </View>
      <MonthSwitcher month={month} onChange={setMonth} />
      <ClayInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search notes, categories, accounts"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <ChipRow>
        {TYPE_FILTERS.map((f) => (
          <Chip
            key={f.value}
            label={f.label}
            icon={f.icon}
            selected={type === f.value}
            onPress={() => setType(f.value)}
          />
        ))}
      </ChipRow>
      {accountsQ.data.length > 1 ? (
        <ChipRow>
          <Chip
            label="All accounts"
            icon="layers"
            selected={!accountId}
            onPress={() => setAccountId(null)}
          />
          {accountsQ.data.map((a) => (
            <Chip
              key={a.id}
              label={a.name}
              icon={a.icon ?? 'wallet'}
              color={a.color ?? undefined}
              selected={accountId === a.id}
              onPress={() => setAccountId(accountId === a.id ? null : a.id)}
            />
          ))}
        </ChipRow>
      ) : null}
      {!loading && !error && data.length > 0 ? (
        <ClayCard style={styles.summary}>
          <Summary label="Spent" value={totals.spent} color={t.colors.expense} />
          <Summary label="Income" value={totals.income} color={t.colors.income} />
          <Summary label="Invested" value={totals.invested} color={t.colors.investment} />
        </ClayCard>
      ) : null}
      {error ? <ErrorState title="Couldn't load transactions" error={error} /> : null}
      {loading ? <SkeletonList rows={5} /> : null}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: t.colors.background }]}>
      <SectionList
        sections={loading || error ? [] : sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 16,
          paddingBottom: TAB_BAR_SPACE + insets.bottom,
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading || error ? undefined : filtered ? (
            <EmptyState
              icon="search"
              title="No matching transactions"
              message="Try another filter or month, or clear the search."
              action={{
                label: 'Clear filters',
                icon: 'refresh',
                onPress: () => {
                  setType('all');
                  setAccountId(null);
                  setSearch('');
                },
              }}
            />
          ) : (
            <EmptyState
              icon="receipt"
              title="No transactions this month"
              message="Everything you add shows up here, grouped by day."
              action={{ label: 'Add transaction', onPress: () => router.navigate('/add') }}
            />
          )
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <AppText variant="label" muted>
              {formatDayHeader(section.date)}
            </AppText>
            {section.spent > 0 ? (
              <AppText variant="caption" muted>
                Spent {formatINR(section.spent)}
              </AppText>
            ) : null}
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View
            style={[
              styles.item,
              {
                backgroundColor: t.colors.surface,
                borderTopLeftRadius: index === 0 ? t.radius.lg : 0,
                borderTopRightRadius: index === 0 ? t.radius.lg : 0,
                borderBottomLeftRadius: index === section.data.length - 1 ? t.radius.lg : 0,
                borderBottomRightRadius: index === section.data.length - 1 ? t.radius.lg : 0,
              },
            ]}
          >
            <TxListItem tx={item} />
          </View>
        )}
      />
      <StatusBarScrim />
    </View>
  );
}

function Summary({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.summaryItem}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <AppText variant="subtitle" color={color} numberOfLines={1} adjustsFontSizeToFit>
        {formatINR(value)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: 14, marginBottom: 6 },
  titleBlock: { gap: 2 },
  summary: { flexDirection: 'row', gap: 8, paddingVertical: 14 },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  item: { paddingHorizontal: 16, paddingVertical: 10 },
});
