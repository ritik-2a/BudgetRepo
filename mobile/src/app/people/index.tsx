import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  ClayButton,
  ClayCard,
  ClayInput,
  ListCard,
  ListRow,
  Screen,
} from '@/components/clay';
import { Banner, EmptyState, ErrorState, SkeletonList, useToast } from '@/components/feedback';
import { createPerson, usePeople } from '@/features/accounts/repo';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

export default function PeopleScreen() {
  const t = useTheme();
  const toast = useToast();
  const { data, loading, error } = usePeople();
  const [name, setName] = useState('');

  const owedToMe = data.filter((p) => p.balance > 0).reduce((s, p) => s + p.balance, 0);
  const iOwe = data.filter((p) => p.balance < 0).reduce((s, p) => s - p.balance, 0);

  const add = () => {
    const n = name.trim();
    if (!n) return toast.error('Enter a name');
    if (data.some((p) => p.name.toLowerCase() === n.toLowerCase())) {
      return toast.info(`${n} is already in your list`);
    }
    createPerson(n);
    setName('');
    toast.success('Friend added', n);
  };

  return (
    <Screen title="Friends & splits" back>
      <ClayCard tint={t.colors.hero} style={styles.hero}>
        <View style={styles.flex}>
          <AppText variant="label" color={t.colors.onHeroMuted}>
            Friends owe you
          </AppText>
          <AppText variant="title" color={t.colors.onHero}>
            {formatINR(owedToMe)}
          </AppText>
        </View>
        <View style={[styles.flex, styles.right]}>
          <AppText variant="label" color={t.colors.onHeroMuted}>
            You owe
          </AppText>
          <AppText variant="title" color={t.colors.onHero}>
            {formatINR(iOwe)}
          </AppText>
        </View>
      </ClayCard>

      {error ? (
        <ErrorState title="Couldn't load friends" error={error} />
      ) : loading ? (
        <SkeletonList rows={3} />
      ) : data.length === 0 ? (
        <EmptyState
          icon="people"
          title="No friends added yet"
          message="Add friends here or while splitting a bill. Clayfin keeps track of who owes whom."
        />
      ) : (
        <ListCard>
          {data
            .slice()
            .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
            .map((p) => (
              <ListRow
                key={p.id}
                icon="person"
                iconColor={t.colors.primary}
                title={p.name}
                subtitle={p.balance > 0 ? 'owes you' : p.balance < 0 ? 'you owe' : 'settled up'}
                right={formatINR(Math.abs(p.balance))}
                rightColor={
                  p.balance > 0
                    ? t.colors.income
                    : p.balance < 0
                      ? t.colors.expense
                      : t.colors.textMuted
                }
                onPress={() => router.push({ pathname: '/people/[id]', params: { id: p.id } })}
              />
            ))}
        </ListCard>
      )}

      <ClayCard style={styles.addCard}>
        <ClayInput
          label="Add a friend"
          value={name}
          onChangeText={setName}
          placeholder="Name"
          onSubmitEditing={add}
          returnKeyType="done"
          maxLength={40}
        />
        <ClayButton title="Add" icon="person-add" variant="secondary" onPress={add} />
      </ClayCard>

      <Banner
        tone="info"
        message="To split a bill: Add → Expense → turn on “Split with friends”. If a friend paid, choose them under “Paid from”."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', paddingVertical: 20 },
  flex: { flex: 1, gap: 4 },
  right: { alignItems: 'flex-end' },
  addCard: { gap: 12 },
});
