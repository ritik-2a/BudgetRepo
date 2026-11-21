import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, ClayButton, ClayCard, IconBadge } from '@/components/clay';
import { useToast } from '@/components/feedback';
import { daysBetween, formatDate, fromISODate } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

import { useAccounts } from '../accounts/repo';
import { useCategories } from '../categories/repo';
import { useFunds } from '../funds/repo';
import { deleteTransaction } from '../transactions/repo';
import { completeDueRule, skipDueRule, useDueReminders } from './repo';

/**
 * Home cards for flexible-date items (salary on the 7th–9th, bills…): stays visible from
 * the expected date until you tap Received/Paid, which logs it on the actual day.
 */
export function DueReminders() {
  const t = useTheme();
  const toast = useToast();
  const due = useDueReminders();
  const cats = useCategories().data;
  const accounts = useAccounts().data;
  const funds = useFunds().data;
  if (due.data.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {due.data.map((rule) => {
        const tpl = rule.template;
        const cat = cats.find((c) => c.id === tpl.categoryId);
        const isIncome = tpl.type === 'income';
        const title =
          tpl.type === 'investment'
            ? (funds.find((f) => f.id === tpl.fundId)?.name ?? 'Investment')
            : (cat?.name ?? 'Recurring item');
        const account = accounts.find((a) => a.id === tpl.accountId)?.name;
        const late = daysBetween(fromISODate(rule.nextRun), new Date());
        const color = isIncome ? t.colors.income : t.colors.warning;

        const done = () => {
          try {
            const id = completeDueRule(rule);
            toast.show('success', {
              title: isIncome ? `${title} received` : `${title} logged`,
              message: `${isIncome ? 'Added' : formatINR(tpl.amount)}${account ? ` · ${account}` : ''} · today`,
              action: { label: 'Undo', onPress: () => deleteTransaction(id) },
            });
          } catch (e) {
            toast.error("Couldn't log it", e);
          }
        };
        const skip = () => {
          skipDueRule(rule);
          toast.info('Skipped for this month');
        };
        const variable = !tpl.amount;
        const customAmount = () =>
          router.navigate({
            pathname: '/add',
            params: {
              type: tpl.type,
              categoryId: tpl.categoryId ?? undefined,
              fundId: tpl.fundId ?? undefined,
              amount: variable ? undefined : String(tpl.amount),
              note: tpl.note ?? undefined,
              ruleId: rule.id,
            },
          });

        return (
          <ClayCard key={rule.id} style={styles.card}>
            <View style={styles.row}>
              <IconBadge name={cat?.icon ?? 'repeat'} color={color} size={42} />
              <View style={styles.flex}>
                <AppText variant="subtitle">
                  {title} {isIncome ? 'expected' : 'due'}
                </AppText>
                <AppText variant="caption" muted>
                  {isIncome ? 'Expected' : variable ? 'Amount varies' : formatINR(tpl.amount)} ·
                  since {formatDate(rule.nextRun)}
                  {late > 0 ? ` (${late} day${late === 1 ? '' : 's'})` : ''}
                </AppText>
              </View>
            </View>
            <View style={styles.row}>
              {variable ? (
                <ClayButton
                  title="Enter amount"
                  icon="create"
                  onPress={customAmount}
                  style={styles.flex}
                />
              ) : (
                <ClayButton
                  title={isIncome ? 'Received' : 'Paid'}
                  icon="checkmark"
                  onPress={done}
                  style={styles.flex}
                />
              )}
              {!variable ? (
                <ClayButton title="Other amount" variant="secondary" onPress={customAmount} />
              ) : null}
              <ClayButton title="Skip" variant="secondary" onPress={skip} />
            </View>
          </ClayCard>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
});
