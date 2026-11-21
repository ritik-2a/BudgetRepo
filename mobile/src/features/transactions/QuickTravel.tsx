import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, IconBadge } from '@/components/clay';
import { useToast } from '@/components/feedback';
import { todayISO } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

import { useAccounts } from '../accounts/repo';
import { useCategories } from '../categories/repo';
import { usePrefs } from '../settings/repo';
import { createTransaction, deleteTransaction } from './repo';

/**
 * One-tap buttons for categories that have a quick amount (Auto ₹50, Metro ₹40).
 * Tap = log today's fare from the last-used account. Long-press = open the form to change it.
 */
export function QuickTravel() {
  const t = useTheme();
  const toast = useToast();
  const prefs = usePrefs();
  const cats = useCategories('expense');
  const accountsQ = useAccounts();
  const quick = cats.data.filter((c) => c.quickAmount && c.quickAmount > 0);
  if (quick.length === 0 || accountsQ.data.length === 0) return null;

  const account =
    accountsQ.data.find((a) => a.id === prefs.lastAccountId) ??
    accountsQ.data.find((a) => a.type === 'wallet' || a.type === 'cash') ??
    accountsQ.data[0];

  const log = (categoryId: string, name: string, amount: number) => {
    // Metro rides come off the metro card when the commute planner is set up.
    const commute = prefs.commute;
    const useMetroCard =
      name === 'Metro' && commute && accountsQ.data.some((a) => a.id === commute.metroAccountId);
    const from = useMetroCard
      ? accountsQ.data.find((a) => a.id === commute!.metroAccountId)!
      : account;
    if (useMetroCard) amount = commute!.fare;
    try {
      const id = createTransaction({
        type: 'expense',
        amount,
        accountId: from.id,
        categoryId,
        date: todayISO(),
      });
      toast.show('success', {
        title: `${name} logged`,
        message: `${formatINR(amount)} · ${from.name} · today`,
        action: { label: 'Undo', onPress: () => deleteTransaction(id) },
      });
    } catch (e) {
      toast.error(`Couldn't log ${name}`, e);
    }
  };

  return (
    <View style={styles.row}>
      {quick.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => log(c.id, c.name, c.quickAmount!)}
          onLongPress={() =>
            router.navigate({
              pathname: '/add',
              params: { categoryId: c.id, amount: String(c.quickAmount), type: 'expense' },
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`Log ${c.name} ${formatINR(c.quickAmount!)}`}
          accessibilityHint="Long press to change the amount"
          android_ripple={{ color: t.colors.ripple }}
          style={[
            styles.btn,
            {
              backgroundColor: t.colors.surface,
              borderRadius: t.radius.lg,
              borderColor: t.colors.border,
            },
          ]}
        >
          <IconBadge name={c.icon} color={c.color} size={36} />
          <View>
            <AppText variant="subtitle">{c.name}</AppText>
            <AppText variant="caption" muted>
              {formatINR(c.quickAmount!)}
            </AppText>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
