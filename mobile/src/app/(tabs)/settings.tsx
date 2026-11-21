import { asc, eq } from 'drizzle-orm';
import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import { AppText, ClayButton, ClayCard, IconBadge, Screen } from '@/components/clay';
import {
  Banner,
  EmptyState,
  ErrorState,
  SkeletonList,
  useConfirm,
  useToast,
} from '@/components/feedback';
import { db } from '@/db/client';
import { accounts, categories, type AccountType } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { useTheme } from '@/theme';

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  bank: 'Bank',
  credit_card: 'Credit card',
  cash: 'Cash',
  wallet: 'Wallet / UPI',
  metro_card: 'Metro card',
};

export default function SettingsScreen() {
  const t = useTheme();
  const accountsQ = useLiveData(
    db.select().from(accounts).where(eq(accounts.deleted, false)).orderBy(asc(accounts.sortOrder)),
  );
  const categoriesQ = useLiveData(
    db
      .select()
      .from(categories)
      .where(eq(categories.deleted, false))
      .orderBy(asc(categories.sortOrder)),
  );

  return (
    <Screen title="Settings">
      <View style={styles.section}>
        <AppText variant="label" muted>
          Accounts
        </AppText>
        {accountsQ.error ? (
          <ErrorState title="Couldn't load accounts" error={accountsQ.error} />
        ) : accountsQ.loading ? (
          <SkeletonList rows={3} />
        ) : accountsQ.data.length === 0 ? (
          <EmptyState
            icon="wallet"
            title="No accounts yet"
            message="Accounts are where money comes from: your bank, credit cards, cash or UPI."
          />
        ) : (
          <ClayCard style={styles.list}>
            {accountsQ.data.map((a) => (
              <View key={a.id} style={styles.row}>
                <IconBadge
                  name={a.icon ?? 'wallet'}
                  color={a.color ?? t.colors.primary}
                  size={36}
                />
                <View style={styles.flex}>
                  <AppText variant="subtitle">{a.name}</AppText>
                  <AppText variant="caption" muted>
                    {ACCOUNT_TYPE_LABEL[a.type]}
                  </AppText>
                </View>
              </View>
            ))}
          </ClayCard>
        )}
        <Banner
          tone="info"
          message="Adding credit cards and editing accounts arrives in Phase 1."
        />
      </View>

      <View style={styles.section}>
        <AppText variant="label" muted>
          Categories
        </AppText>
        {categoriesQ.error ? (
          <ErrorState title="Couldn't load categories" error={categoriesQ.error} />
        ) : categoriesQ.loading ? (
          <SkeletonList rows={2} />
        ) : (
          <ClayCard style={styles.chips}>
            {categoriesQ.data.map((c) => (
              <View
                key={c.id}
                style={[
                  styles.chip,
                  { backgroundColor: t.colors.surfaceSunken, boxShadow: t.shadow('pressed') },
                ]}
              >
                <IconBadge name={c.icon} color={c.color} size={24} />
                <AppText variant="caption">{c.parentId ? `↳ ${c.name}` : c.name}</AppText>
              </View>
            ))}
          </ClayCard>
        )}
      </View>

      {__DEV__ ? <FeedbackPreview /> : null}

      <AppText variant="caption" muted style={styles.version}>
        Budget Tracker v{Constants.expoConfig?.version ?? '1.0.0'} · data stored on this device
      </AppText>
    </Screen>
  );
}

/** Development-only panel to preview every notification style on a real phone. */
function FeedbackPreview() {
  const toast = useToast();
  const confirm = useConfirm();

  return (
    <View style={styles.section}>
      <AppText variant="label" muted>
        Preview notifications (dev only)
      </AppText>
      <ClayCard style={styles.list}>
        <View style={styles.buttonRow}>
          <ClayButton
            title="Success"
            icon="checkmark"
            variant="secondary"
            onPress={() => toast.success('Expense added', '₹50 · Auto · Cash')}
          />
          <ClayButton
            title="Error"
            icon="alert"
            variant="secondary"
            onPress={() =>
              toast.error("Couldn't save transaction", new Error('Amount must be greater than ₹0'))
            }
          />
        </View>
        <View style={styles.buttonRow}>
          <ClayButton
            title="Warning"
            icon="warning"
            variant="secondary"
            onPress={() => toast.warning('Budget almost used', "You've spent 85% of Food & Dining")}
          />
          <ClayButton
            title="Info"
            icon="information"
            variant="secondary"
            onPress={() => toast.info('Card bill due in 3 days', 'HDFC Card · ₹12,450')}
          />
        </View>
        <ClayButton
          title="Confirm dialog"
          icon="trash"
          variant="secondary"
          onPress={async () => {
            const ok = await confirm({
              title: 'Delete this transaction?',
              message: '₹50 · Auto on 21 Nov. This cannot be undone.',
              destructive: true,
            });
            if (ok) toast.success('Transaction deleted');
            else toast.info('Delete cancelled');
          }}
        />
      </ClayCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  list: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  buttonRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  version: { textAlign: 'center' },
});
