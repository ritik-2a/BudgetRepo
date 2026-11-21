import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  ClayButton,
  ClayCard,
  IconButton,
  ListCard,
  ListRow,
  Screen,
  SectionTitle,
  SwitchRow,
} from '@/components/clay';
import { EmptyState, ErrorState, SkeletonList } from '@/components/feedback';
import {
  ACCOUNT_TYPE_META,
  useAccountBalances,
  type AccountWithBalance,
} from '@/features/accounts/repo';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

export default function AccountsScreen() {
  const t = useTheme();
  const [showArchived, setShowArchived] = useState(false);
  const { data, loading, error } = useAccountBalances(showArchived);

  const cards = data.filter((a) => a.type === 'credit_card');
  const others = data.filter((a) => a.type !== 'credit_card' && a.type !== 'receivable');
  const assets = others.filter((a) => !a.archived).reduce((s, a) => s + a.balance, 0);
  const owed = cards.filter((a) => !a.archived).reduce((s, a) => s + Math.max(0, a.outstanding), 0);

  const open = (id: string) => router.push({ pathname: '/accounts/[id]', params: { id } });

  return (
    <Screen
      title="Accounts"
      back
      right={
        <IconButton icon="add" label="Add account" onPress={() => router.push('/accounts/new')} />
      }
    >
      {error ? (
        <ErrorState title="Couldn't load accounts" error={error} />
      ) : loading ? (
        <SkeletonList rows={4} />
      ) : data.length === 0 ? (
        <EmptyState
          icon="wallet"
          title="No accounts yet"
          message="Add your bank account, credit cards, cash or UPI wallet."
          action={{ label: 'Add account', onPress: () => router.push('/accounts/new') }}
        />
      ) : (
        <>
          <ClayCard style={styles.summary}>
            <View style={styles.summaryItem}>
              <AppText variant="caption" muted>
                Money you have
              </AppText>
              <AppText variant="title" color={t.colors.income}>
                {formatINR(assets)}
              </AppText>
            </View>
            <View style={styles.summaryItem}>
              <AppText variant="caption" muted>
                Card dues
              </AppText>
              <AppText variant="title" color={t.colors.creditCard}>
                {formatINR(owed)}
              </AppText>
            </View>
          </ClayCard>

          {others.length > 0 ? (
            <>
              <SectionTitle title="Bank, cash & wallets" />
              <ListCard>
                {others.map((a) => (
                  <AccountRow key={a.id} a={a} onPress={() => open(a.id)} />
                ))}
              </ListCard>
            </>
          ) : null}

          <SectionTitle
            title="Credit cards"
            action="Add card"
            onAction={() =>
              router.push({
                pathname: '/accounts/[id]',
                params: { id: 'new', type: 'credit_card' },
              })
            }
          />
          {cards.length > 0 ? (
            <ListCard>
              {cards.map((a) => (
                <AccountRow key={a.id} a={a} onPress={() => open(a.id)} />
              ))}
            </ListCard>
          ) : (
            <EmptyState
              icon="card"
              title="No credit cards"
              message="Add a card with its statement and due dates to track each billing cycle and get bill reminders."
              action={{
                label: 'Add credit card',
                onPress: () =>
                  router.push({
                    pathname: '/accounts/[id]',
                    params: { id: 'new', type: 'credit_card' },
                  }),
              }}
            />
          )}

          <ClayCard>
            <SwitchRow
              title="Show archived accounts"
              value={showArchived}
              onChange={setShowArchived}
            />
          </ClayCard>
        </>
      )}
      {!loading && data.length > 0 ? (
        <ClayButton
          title="Add account"
          icon="add"
          variant="secondary"
          fullWidth
          onPress={() => router.push('/accounts/new')}
        />
      ) : null}
    </Screen>
  );
}

function AccountRow({ a, onPress }: { a: AccountWithBalance; onPress: () => void }) {
  const t = useTheme();
  const meta = ACCOUNT_TYPE_META[a.type];
  if (a.type === 'credit_card') {
    const util = a.creditLimit
      ? Math.round((Math.max(0, a.outstanding) / a.creditLimit) * 100)
      : null;
    return (
      <ListRow
        icon={a.icon ?? meta.icon}
        iconColor={a.color ?? meta.color}
        title={a.name}
        subtitle={`${meta.label}${a.archived ? ' · archived' : ''}${util !== null ? ` · ${util}% used` : ''}`}
        right={formatINR(Math.max(0, a.outstanding))}
        rightSub={a.outstanding < 0 ? `${formatINR(-a.outstanding)} credit` : 'outstanding'}
        rightColor={a.outstanding > 0 ? t.colors.creditCard : t.colors.text}
        onPress={onPress}
        muted={a.archived}
      />
    );
  }
  return (
    <ListRow
      icon={a.icon ?? meta.icon}
      iconColor={a.color ?? meta.color}
      title={a.name}
      subtitle={`${meta.label}${a.archived ? ' · archived' : ''}`}
      right={formatINR(a.balance)}
      rightColor={a.balance < 0 ? t.colors.danger : t.colors.text}
      onPress={onPress}
      muted={a.archived}
    />
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: 12 },
  summaryItem: { flex: 1, gap: 4 },
});
