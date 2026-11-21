import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, ClayCard, IconBadge } from '@/components/clay';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

import { usePeople } from '../accounts/repo';

/** Home card: money friends owe you / you owe them. Hidden when everything is settled. */
export function PeopleSummary() {
  const t = useTheme();
  const people = usePeople().data;
  const owed = people.filter((p) => p.balance > 0);
  const owe = people.filter((p) => p.balance < 0);
  if (owed.length === 0 && owe.length === 0) return null;
  const owedTotal = owed.reduce((s, p) => s + p.balance, 0);
  const oweTotal = owe.reduce((s, p) => s - p.balance, 0);
  const names = owed
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 3)
    .map((p) => `${p.name} ${formatINR(p.balance)}`)
    .join(' · ');

  return (
    <Pressable
      onPress={() => router.push('/people')}
      accessibilityRole="button"
      accessibilityLabel={`Friends owe you ${formatINR(owedTotal)}`}
    >
      <ClayCard style={styles.card}>
        <IconBadge name="people" color={t.colors.primary} size={40} />
        <View style={styles.flex}>
          <AppText variant="subtitle">
            {owedTotal > 0
              ? `${formatINR(owedTotal)} to get back`
              : `You owe ${formatINR(oweTotal)}`}
          </AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            {owedTotal > 0 ? names : owe.map((p) => p.name).join(', ')}
            {owedTotal > 0 && oweTotal > 0 ? ` · you owe ${formatINR(oweTotal)}` : ''}
          </AppText>
        </View>
        <AppText variant="caption" weight="600" color={t.colors.primary}>
          Settle
        </AppText>
      </ClayCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 2 },
});
