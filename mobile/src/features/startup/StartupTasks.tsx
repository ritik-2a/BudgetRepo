import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useToast } from '@/components/feedback';

import { processDueRules } from '../recurring/repo';
import { configureNotifications, rescheduleReminders } from '../reminders/notifications';

/**
 * Runs when the app opens and each time it returns to the foreground:
 *  - creates due recurring transactions (salary, SIPs, rent…)
 *  - refreshes scheduled reminders
 */
export function StartupTasks() {
  const toast = useToast();
  const lastRun = useRef(0);

  useEffect(() => {
    const run = () => {
      // At most once a minute.
      if (Date.now() - lastRun.current < 60_000) return;
      lastRun.current = Date.now();
      try {
        const created = processDueRules();
        if (created > 0) {
          toast.info(
            `${created} recurring transaction${created === 1 ? '' : 's'} added`,
            'Check History to review them.',
          );
        }
      } catch (e) {
        toast.error("Couldn't add recurring transactions", e);
      }
      configureNotifications()
        .then(() => rescheduleReminders())
        .catch(() => {
          // Reminders are best-effort; failures surface on the Reminders screen.
        });
    };
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
