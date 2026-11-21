import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  ClayButton,
  ClayCard,
  IconBadge,
  Screen,
  SegmentedControl,
  SwitchRow,
} from '@/components/clay';
import {
  Banner,
  EmptyState,
  ErrorState,
  SkeletonList,
  useConfirm,
  useToast,
} from '@/components/feedback';
import { useAccounts } from '@/features/accounts/repo';
import { useCategories } from '@/features/categories/repo';
import { useFunds } from '@/features/funds/repo';
import { deleteRule, updateRule, useRules, type RecurringRule } from '@/features/recurring/repo';
import { rescheduleReminders } from '@/features/reminders/notifications';
import { formatDate, ordinal } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme';

export default function RecurringScreen() {
  const { data, loading, error } = useRules();

  return (
    <Screen title="Recurring" back>
      <Banner
        tone="info"
        message='Turn on "Repeat every month" when adding a transaction (salary, SIP, rent, subscriptions) and it shows up here.'
      />
      {error ? (
        <ErrorState title="Couldn't load recurring items" error={error} />
      ) : loading ? (
        <SkeletonList rows={3} />
      ) : data.length === 0 ? (
        <EmptyState
          icon="repeat"
          title="Nothing recurring yet"
          message="Add your salary or a SIP and switch on Repeat every month."
          action={{ label: 'Add transaction', onPress: () => router.navigate('/add') }}
        />
      ) : (
        data.map((r) => <RuleCard key={r.id} rule={r} />)
      )}
    </Screen>
  );
}

function RuleCard({ rule }: { rule: RecurringRule }) {
  const t = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const accounts = useAccounts(true).data;
  const cats = useCategories().data;
  const funds = useFunds(true).data;
  const tpl = rule.template;

  const cat = cats.find((c) => c.id === tpl.categoryId);
  const title =
    tpl.type === 'investment'
      ? (funds.find((f) => f.id === tpl.fundId)?.name ?? 'Investment')
      : tpl.type === 'transfer'
        ? `${accounts.find((a) => a.id === tpl.accountId)?.name} → ${accounts.find((a) => a.id === tpl.toAccountId)?.name}`
        : (cat?.name ?? 'Transaction');
  const color =
    tpl.type === 'income'
      ? t.colors.income
      : tpl.type === 'investment'
        ? t.colors.investment
        : tpl.type === 'transfer'
          ? t.colors.transfer
          : (cat?.color ?? t.colors.expense);

  const apply = (patch: Parameters<typeof updateRule>[1]) => {
    try {
      updateRule(rule.id, patch);
      rescheduleReminders().catch(() => {});
    } catch (e) {
      toast.error("Couldn't update", e);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Stop repeating?',
      message: 'Transactions already created stay in your history.',
      destructive: true,
      confirmLabel: 'Stop',
    });
    if (!ok) return;
    deleteRule(rule.id);
    toast.success('Recurring item removed');
  };

  return (
    <ClayCard style={[styles.card, !rule.enabled && { opacity: 0.6 }]}>
      <View style={styles.row}>
        <IconBadge name={cat?.icon ?? 'repeat'} color={color} size={42} />
        <View style={styles.flex}>
          <AppText variant="subtitle">{title}</AppText>
          <AppText variant="caption" muted>
            {formatINR(tpl.amount)} · every month on the {ordinal(rule.day)}
          </AppText>
          <AppText variant="caption" muted>
            Next: {formatDate(rule.nextRun)}
          </AppText>
        </View>
      </View>
      <SegmentedControl
        options={[
          { value: 'auto_create', label: 'Add automatically' },
          { value: 'remind_only', label: 'Just remind me' },
        ]}
        value={rule.mode}
        onChange={(mode) => apply({ mode })}
      />
      <SwitchRow title="Active" value={rule.enabled} onChange={(enabled) => apply({ enabled })} />
      <ClayButton title="Remove" icon="trash" variant="secondary" onPress={remove} />
    </ClayCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 2 },
});
