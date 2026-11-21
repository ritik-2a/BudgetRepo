import { useEffect, useState } from 'react';
import { Linking, StyleSheet } from 'react-native';

import { AppText, ClayButton, ClayCard, Screen, SwitchRow, TimeField } from '@/components/clay';
import { Banner, useToast } from '@/components/feedback';
import {
  hasNotificationPermission,
  requestNotificationPermission,
  rescheduleReminders,
  sendTestNotification,
} from '@/features/reminders/notifications';
import { setPref, usePrefs, type Prefs } from '@/features/settings/repo';

export default function RemindersScreen() {
  const toast = useToast();
  const prefs = usePrefs();
  const [permission, setPermission] = useState<boolean | null>(null);

  useEffect(() => {
    hasNotificationPermission()
      .then(setPermission)
      .catch(() => setPermission(false));
  }, []);

  const update = async <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPref(key, value);
    if (value === true && !permission) {
      const granted = await requestNotificationPermission();
      setPermission(granted);
      if (!granted) {
        toast.warning(
          'Notifications are off',
          'Allow notifications for Budget Tracker in your phone settings to get reminders.',
        );
        return;
      }
    }
    try {
      const n = await rescheduleReminders();
      toast.success('Reminders updated', `${n} reminder${n === 1 ? '' : 's'} scheduled`);
    } catch (e) {
      toast.error("Couldn't schedule reminders", e);
    }
  };

  const enable = async () => {
    const granted = await requestNotificationPermission();
    setPermission(granted);
    if (granted) {
      const n = await rescheduleReminders();
      toast.success('Notifications enabled', `${n} reminder${n === 1 ? '' : 's'} scheduled`);
    } else {
      toast.warning('Permission denied', 'Open settings to allow notifications.');
    }
  };

  return (
    <Screen title="Reminders" back>
      {permission === false ? (
        <ClayCard style={styles.gap}>
          <Banner
            tone="warning"
            title="Notifications are off"
            message="Reminders can't be delivered until you allow notifications."
          />
          <ClayButton title="Allow notifications" icon="notifications" fullWidth onPress={enable} />
          <ClayButton
            title="Open phone settings"
            variant="secondary"
            fullWidth
            onPress={() => Linking.openSettings()}
          />
        </ClayCard>
      ) : null}

      <ClayCard style={styles.gap}>
        <SwitchRow
          icon="create"
          title="Daily reminder to log expenses"
          subtitle="A nudge every day so nothing is missed"
          value={prefs.dailyReminder}
          onChange={(v) => update('dailyReminder', v)}
        />
        {prefs.dailyReminder ? (
          <TimeField
            label="Remind me at"
            value={prefs.dailyReminderTime}
            onChange={(v) => update('dailyReminderTime', v)}
          />
        ) : null}
      </ClayCard>

      <ClayCard style={styles.gap}>
        <SwitchRow
          icon="card"
          title="Credit card bill reminders"
          subtitle="5 days before, 2 days before and on the due date"
          value={prefs.billReminders}
          onChange={(v) => update('billReminders', v)}
        />
        <SwitchRow
          icon="trending-up"
          title="SIP reminders"
          subtitle="On each fund's SIP date"
          value={prefs.sipReminders}
          onChange={(v) => update('sipReminders', v)}
        />
      </ClayCard>

      <AppText variant="caption" muted>
        Budget alerts appear in the app when you add an expense that takes a budget past 80% or
        100%. Recurring items set to “Just remind me” also send a reminder on their date.
      </AppText>

      {permission ? (
        <ClayButton
          title="Send a test notification"
          icon="notifications"
          variant="secondary"
          fullWidth
          onPress={() =>
            sendTestNotification()
              .then(() => toast.info('Test sent', 'It should arrive in a couple of seconds.'))
              .catch((e) => toast.error("Couldn't send test", e))
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 14 },
});
