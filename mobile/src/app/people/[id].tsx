import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, ClayButton, ClayCard, ListCard, Screen, SectionTitle } from '@/components/clay';
import { EmptyState, SkeletonList, useConfirm, useToast } from '@/components/feedback';
import { setAccountArchived, usePeople } from '@/features/accounts/repo';
import { useTransactions } from '@/features/transactions/repo';
import { TxListItem } from '@/features/transactions/TxListItem';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

export default function PersonScreen() {
  const t = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const { id } = useLocalSearchParams<{ id: string }>();
  const people = usePeople();
  const person = people.data.find((p) => p.id === id);
  const history = useTransactions({ start: '0000-01-01', end: '9999-12-31', accountId: id });

  if (!person) {
    return (
      <Screen title="Friend" back>
        {people.loading ? (
          <SkeletonList rows={2} />
        ) : (
          <EmptyState icon="search" title="Friend not found" />
        )}
      </Screen>
    );
  }

  const owesMe = person.balance > 0;
  const iOwe = person.balance < 0;
  const amount = Math.abs(person.balance);

  const remove = async () => {
    if (person.balance !== 0) {
      toast.warning('Settle up first', `${person.name}'s balance must be ₹0 before removing.`);
      return;
    }
    const ok = await confirm({
      title: `Remove ${person.name}?`,
      message: 'Past split bills stay in your history.',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    setAccountArchived(person.id, true);
    toast.success('Removed', person.name);
    router.back();
  };

  return (
    <Screen title={person.name} back>
      <ClayCard tint={t.colors.hero} style={styles.hero}>
        <AppText variant="label" color={t.colors.onHeroMuted}>
          {owesMe ? `${person.name} owes you` : iOwe ? `You owe ${person.name}` : 'All settled'}
        </AppText>
        <AppText variant="display" color={t.colors.onHero}>
          {formatINR(amount)}
        </AppText>
      </ClayCard>

      {owesMe ? (
        <ClayButton
          title={`${person.name} paid me back`}
          icon="arrow-down"
          size="lg"
          fullWidth
          onPress={() =>
            router.navigate({
              pathname: '/add',
              params: { type: 'transfer', accountId: person.id, amount: String(amount) },
            })
          }
        />
      ) : null}
      {iOwe ? (
        <ClayButton
          title={`I paid ${person.name} back`}
          icon="arrow-up"
          size="lg"
          fullWidth
          onPress={() =>
            router.navigate({
              pathname: '/add',
              params: { type: 'transfer', toAccountId: person.id, amount: String(amount) },
            })
          }
        />
      ) : null}
      {owesMe || iOwe ? (
        <AppText variant="caption" muted>
          Change the amount for a part payment, and pick the account the money went to or came from.
        </AppText>
      ) : null}

      <SectionTitle title="History" />
      {history.loading ? (
        <SkeletonList rows={3} />
      ) : history.data.length === 0 ? (
        <EmptyState bare icon="receipt" title="Nothing yet" />
      ) : (
        <ListCard>
          {history.data.map((tx) => (
            <TxListItem key={tx.id} tx={tx} showDate />
          ))}
        </ListCard>
      )}

      <View style={styles.footer}>
        <ClayButton title="Remove friend" icon="trash" variant="secondary" onPress={remove} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 6, paddingVertical: 22 },
  footer: { alignItems: 'flex-start' },
});
