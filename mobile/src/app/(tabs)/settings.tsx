import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  ClayButton,
  ClayCard,
  ListCard,
  ListRow,
  Screen,
  SectionTitle,
  SwitchRow,
} from '@/components/clay';
import { useConfirm, useToast } from '@/components/feedback';
import { exportTransactionsCSV } from '@/features/export/csv-export';
import { authenticate, canUseAppLock } from '@/features/security/AppLock';
import { setPref, usePrefs } from '@/features/settings/repo';

export default function SettingsScreen() {
  const toast = useToast();
  const prefs = usePrefs();
  const [exporting, setExporting] = useState(false);

  const toggleLock = async (on: boolean) => {
    try {
      if (on) {
        const check = await canUseAppLock();
        if (!check.ok) {
          toast.warning("App lock can't be turned on", check.reason);
          return;
        }
      }
      // Confirm it's really the owner before changing the lock either way.
      if (
        !(await authenticate(on ? 'Confirm to turn on app lock' : 'Confirm to turn off app lock'))
      ) {
        toast.info('App lock unchanged');
        return;
      }
      setPref('appLock', on);
      toast.success(
        on ? 'App lock on' : 'App lock off',
        on ? 'Unlock with fingerprint, face or PIN.' : undefined,
      );
    } catch (e) {
      toast.error("Couldn't change app lock", e);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const n = await exportTransactionsCSV();
      toast.success('Export ready', `${n} transaction${n === 1 ? '' : 's'} in the CSV file`);
    } catch (e) {
      toast.error('Export failed', e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen title="Settings">
      <SectionTitle title="Money setup" />
      <ListCard>
        <ListRow
          icon="wallet"
          title="Accounts & credit cards"
          subtitle="Bank, cards, cash, UPI, metro card"
          onPress={() => router.push('/accounts')}
        />
        <ListRow
          icon="pricetags"
          title="Categories"
          subtitle="Edit categories and quick-add fares"
          onPress={() => router.push('/categories')}
        />
        <ListRow
          icon="speedometer"
          title="Budgets"
          subtitle="Monthly limits with 80% / 100% alerts"
          onPress={() => router.push('/budgets')}
        />
        <ListRow
          icon="trending-up"
          title="Mutual funds"
          subtitle="Funds, SIPs and current values"
          onPress={() => router.push('/funds')}
        />
        <ListRow
          icon="flag"
          title="Goals"
          subtitle="Savings targets and progress"
          onPress={() => router.push('/goals')}
        />
        <ListRow
          icon="repeat"
          title="Recurring"
          subtitle="Salary, SIPs, rent, subscriptions"
          onPress={() => router.push('/recurring')}
        />
      </ListCard>

      <SectionTitle title="Notifications & security" />
      <ListCard>
        <ListRow
          icon="notifications"
          title="Reminders"
          subtitle="Daily log, card bills, SIP dates"
          onPress={() => router.push('/reminders')}
        />
        <SwitchRow
          icon="finger-print"
          title="App lock"
          subtitle="Fingerprint, face or phone PIN when opening the app"
          value={prefs.appLock}
          onChange={toggleLock}
        />
      </ListCard>

      <SectionTitle title="Data" />
      <ListCard>
        <ListRow
          icon="cloud"
          title="Cloud sync"
          subtitle={
            prefs.syncEmail ? `Signed in as ${prefs.syncEmail}` : 'Back up to MongoDB Atlas'
          }
          onPress={() => router.push('/sync')}
        />
      </ListCard>
      <ClayCard style={styles.gap}>
        <AppText variant="caption" muted>
          Export every transaction to a CSV file you can open in Excel or Google Sheets, or keep as
          a backup.
        </AppText>
        <ClayButton
          title="Export to CSV"
          icon="download"
          variant="secondary"
          loading={exporting}
          onPress={exportCsv}
        />
      </ClayCard>

      {__DEV__ ? <FeedbackPreview /> : null}

      <AppText variant="caption" muted style={styles.version}>
        Budget Tracker v{Constants.expoConfig?.version ?? '1.0.0'} · stored on this device
      </AppText>
    </Screen>
  );
}

/** Development-only panel to preview every notification style on a real phone. */
function FeedbackPreview() {
  const toast = useToast();
  const confirm = useConfirm();
  return (
    <View style={styles.gap}>
      <SectionTitle title="Preview notifications (dev only)" />
      <ClayCard style={styles.gap}>
        <View style={styles.buttonRow}>
          <ClayButton
            title="Success"
            variant="secondary"
            onPress={() => toast.success('Expense added', '₹50 · Auto · Cash')}
          />
          <ClayButton
            title="Error"
            variant="secondary"
            onPress={() =>
              toast.error("Couldn't save transaction", new Error('Amount must be greater than ₹0'))
            }
          />
          <ClayButton
            title="Warning"
            variant="secondary"
            onPress={() => toast.warning('Budget almost used', "You've spent 85% of Food & Dining")}
          />
          <ClayButton
            title="Dialog"
            variant="secondary"
            onPress={async () => {
              const ok = await confirm({
                title: 'Delete this transaction?',
                message: '₹50 · Auto on 21 Nov.',
                destructive: true,
              });
              toast.info(ok ? 'Confirmed' : 'Cancelled');
            }}
          />
        </View>
      </ClayCard>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  version: { textAlign: 'center' },
});
