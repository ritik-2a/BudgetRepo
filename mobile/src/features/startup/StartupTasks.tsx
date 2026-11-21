import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useToast } from '@/components/feedback';

import { processDueRules } from '../recurring/repo';
import { getPrefs } from '../settings/repo';
import { getToken } from '../sync/api';
import { syncNow } from '../sync/engine';
import { applyUpdate, checkAndDownload } from '../updates/ota';
import { configureNotifications, rescheduleReminders } from '../reminders/notifications';

/**
 * Runs when the app opens and each time it returns to the foreground:
 *  - creates due recurring transactions (salary, SIPs, rent…)
 *  - refreshes scheduled reminders
 *  - syncs with the cloud when signed in
 *  - downloads OTA app updates and offers a restart
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
      // Background sync: silent unless it brings in new data.
      const prefs = getPrefs();
      if (prefs.syncAuto && prefs.syncServerUrl) {
        getToken()
          .then((tk) => (tk ? syncNow() : null))
          .then((r) => {
            if (r && r.pulled > 0) {
              toast.info(
                'Synced',
                `${r.pulled} change${r.pulled === 1 ? '' : 's'} from your other devices`,
              );
            }
          })
          .catch(() => {
            // Offline or server not running: try again next time; manual sync shows errors.
          });
      }
      checkAndDownload()
        .then((r) => {
          if (r.kind === 'downloaded') {
            toast.show('info', {
              title: 'App update ready',
              message: r.message ?? 'Restart to get the latest improvements.',
              duration: 15000,
              action: { label: 'Restart', onPress: () => applyUpdate().catch(() => {}) },
            });
          }
        })
        .catch(() => {
          // No network / server down: the app keeps running the current version.
        });
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
