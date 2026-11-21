import { and, eq } from 'drizzle-orm';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { db } from '@/db/client';
import { accounts, funds } from '@/db/schema';
import { upcomingDueDates } from '@/lib/billing-cycle';
import { addDays, clampedDate, formatDate, fromISODate } from '@/lib/dates';
import { formatINR } from '@/lib/money';

import { listActiveRules } from '../recurring/repo';
import { getPrefs } from '../settings/repo';

const CHANNEL_ID = 'reminders';
const REMINDER_HOUR = 9;

let configured = false;

/** Shows notifications while the app is open and creates the Android channel. */
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      // Exported via `export *`, which import/namespace can't follow.
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: '#5B50E6',
    });
  }
}

export async function hasNotificationPermission(): Promise<boolean> {
  const s = await Notifications.getPermissionsAsync();
  return s.granted;
}

/** Asks for permission (shows the system prompt once). */
export async function requestNotificationPermission(): Promise<boolean> {
  await configureNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

type Planned = { title: string; body: string; when: Date };

function at(d: Date, hour = REMINDER_HOUR, minute = 0): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute);
}

/** Builds the list of one-off reminders for the next ~2 months. Exported for tests. */
export function planReminders(now = new Date()): Planned[] {
  const prefs = getPrefs();
  const out: Planned[] = [];

  if (prefs.billReminders) {
    const cards = db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.type, 'credit_card'),
          eq(accounts.archived, false),
          eq(accounts.deleted, false),
        ),
      )
      .all();
    for (const c of cards) {
      if (!c.statementDay || !c.dueDay) continue;
      for (const due of upcomingDueDates(c.statementDay, c.dueDay, 2, now)) {
        for (const before of [5, 2, 0]) {
          const when = at(addDays(due, -before));
          if (when <= now) continue;
          out.push({
            title:
              before === 0 ? `${c.name} bill due today` : `${c.name} bill due in ${before} days`,
            body: `Pay by ${formatDate(due)} to avoid late fees. Log the payment as a transfer to the card.`,
            when,
          });
        }
      }
    }
  }

  if (prefs.sipReminders) {
    const fundList = db
      .select()
      .from(funds)
      .where(and(eq(funds.archived, false), eq(funds.deleted, false)))
      .all();
    for (const f of fundList) {
      if (!f.sipDay) continue;
      for (let i = 0; i < 2; i++) {
        const sipDate = clampedDate(now.getFullYear(), now.getMonth() + i, f.sipDay);
        const when = at(sipDate);
        if (when <= now) continue;
        out.push({
          title: `SIP today: ${f.name}`,
          body: f.sipAmount
            ? `${formatINR(f.sipAmount)} goes out today. Log it as an investment.`
            : 'Your SIP goes out today. Log it as an investment.',
          when,
        });
      }
    }
  }

  for (const rule of listActiveRules()) {
    if (rule.mode !== 'remind_only') continue;
    const when = at(fromISODate(rule.nextRun));
    if (when <= now) continue;
    out.push({
      title: 'Recurring payment due',
      body: `${formatINR(rule.template.amount)} today. Open the app to log it.`,
      when,
    });
  }

  return out.sort((a, b) => a.when.getTime() - b.when.getTime()).slice(0, 50);
}

/**
 * Cancels and re-creates every scheduled reminder from the current data and
 * preferences. Safe to call often (app start, after editing cards/funds/settings).
 * Does nothing if notification permission has not been granted.
 */
export async function rescheduleReminders(): Promise<number> {
  await configureNotifications();
  if (!(await hasNotificationPermission())) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();

  const prefs = getPrefs();
  let count = 0;

  if (prefs.dailyReminder) {
    const [hour, minute] = prefs.dailyReminderTime.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Log today’s expenses',
        body: 'Auto, metro, food, shopping… add them now while you remember.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: CHANNEL_ID,
      },
    });
    count++;
  }

  for (const p of planReminders()) {
    await Notifications.scheduleNotificationAsync({
      content: { title: p.title, body: p.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.when,
        channelId: CHANNEL_ID,
      },
    });
    count++;
  }
  return count;
}

/** Sends a notification immediately (used by the "Send test" button). */
export async function sendTestNotification(): Promise<void> {
  await configureNotifications();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Reminders are working',
      body: 'You will get bill, SIP and daily reminders like this one.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      channelId: CHANNEL_ID,
    },
  });
}
