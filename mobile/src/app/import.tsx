import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { AppText, ClayButton, ListCard, ListRow, Screen } from '@/components/clay';
import { Banner, ErrorState, useToast } from '@/components/feedback';
import { ACCOUNT_TYPE_META } from '@/features/accounts/repo';
import { rescheduleReminders } from '@/features/reminders/notifications';
import { applySetup, decodePayload } from '@/features/setup/importSetup';
import { ordinal } from '@/lib/dates';
import { formatINR } from '@/lib/money';

/** clayfin://import?d=<base64url JSON> — shows what will be set up and asks to confirm. */
export default function ImportScreen() {
  const toast = useToast();
  const { d } = useLocalSearchParams<{ d?: string }>();
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => {
    try {
      return { payload: d ? decodePayload(d) : null, error: d ? null : new Error('No setup data') };
    } catch (e) {
      return { payload: null, error: e };
    }
  }, [d]);

  if (!parsed.payload) {
    return (
      <Screen title="Import setup" back>
        <ErrorState title="Couldn't read the setup" error={parsed.error} />
      </Screen>
    );
  }
  const p = parsed.payload;

  const apply = () => {
    setBusy(true);
    try {
      const log = applySetup(p);
      rescheduleReminders().catch(() => {});
      toast.success('Setup imported', log.join(' · '));
      router.replace('/');
    } catch (e) {
      toast.error('Import failed. Nothing was changed', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Import setup" back>
      <Banner
        tone="warning"
        title="Check before importing"
        message="These accounts, funds and reminders will be added to Clayfin (accounts with the same name are updated). Existing transactions are not changed."
      />
      {p.accounts?.length ? (
        <ListCard>
          {p.accounts.map((a) => (
            <ListRow
              key={a.name}
              icon={ACCOUNT_TYPE_META[a.type].icon}
              iconColor={ACCOUNT_TYPE_META[a.type].color}
              title={a.name}
              subtitle={
                a.type === 'credit_card'
                  ? `Credit card · statement ${ordinal(a.statementDay ?? 0)}, due ${ordinal(a.dueDay ?? 0)}`
                  : ACCOUNT_TYPE_META[a.type].label
              }
              right={formatINR(a.balance)}
              rightSub={a.type === 'credit_card' ? 'outstanding' : 'balance'}
            />
          ))}
        </ListCard>
      ) : null}
      {p.funds?.length ? (
        <ListCard>
          {p.funds.map((f) => (
            <ListRow
              key={f.name}
              icon="trending-up"
              title={f.name}
              subtitle="Mutual fund"
              right={f.sipAmount ? `${formatINR(f.sipAmount)}/mo` : undefined}
            />
          ))}
        </ListCard>
      ) : null}
      {p.salary || p.commute ? (
        <ListCard>
          {p.salary ? (
            <ListRow
              icon="briefcase"
              title={`Salary ${formatINR(p.salary.amount)}`}
              subtitle={`Reminder from the ${ordinal(p.salary.day)} until you mark it received`}
            />
          ) : null}
          {p.commute ? (
            <ListRow
              icon="train"
              title="Metro commute planner"
              subtitle={`${formatINR(p.commute.fare)} one way · ${p.commute.metroAccountName}`}
            />
          ) : null}
        </ListCard>
      ) : null}
      <ClayButton
        title="Import"
        icon="download"
        size="lg"
        fullWidth
        loading={busy}
        onPress={apply}
      />
      <AppText variant="caption" muted style={styles.center}>
        You can edit everything later in Settings.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({ center: { textAlign: 'center' } });
