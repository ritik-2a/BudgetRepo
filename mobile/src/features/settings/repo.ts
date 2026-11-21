import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { settings } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';

/** Typed app preferences stored in the `settings` key/value table. */
export type Prefs = {
  appLock: boolean;
  dailyReminder: boolean;
  dailyReminderTime: string; // "HH:mm"
  billReminders: boolean;
  sipReminders: boolean;
  lastAccountId: string | null;
  /** Cloud sync */
  syncServerUrl: string;
  syncEmail: string | null;
  syncCursor: number;
  syncLastPushAt: number;
  syncLastAt: number | null;
  syncAuto: boolean;
  /** Appearance: follow the phone, or force light/dark. */
  themeMode: 'system' | 'light' | 'dark';
  /** Metro commute planner (null = not set up). */
  commute: CommutePrefs | null;
};

export type CommutePrefs = {
  metroAccountId: string;
  /** One-way fare, paise */
  fare: number;
  tripsPerDay: number;
  /** 0 = Sun … 6 = Sat */
  workDays: number[];
  /** "YYYY-MM-DD" → no travel that day */
  overrides: Record<string, 'off'>;
};

export const DEFAULT_PREFS: Prefs = {
  appLock: false,
  dailyReminder: false,
  dailyReminderTime: '21:00',
  billReminders: true,
  sipReminders: true,
  lastAccountId: null,
  syncServerUrl: 'https://budget-tracker-ritik.vercel.app',
  syncEmail: null,
  syncCursor: 0,
  syncLastPushAt: 0,
  syncLastAt: null,
  syncAuto: true,
  themeMode: 'system',
  commute: null,
};

const PREFIX = 'pref.';

function parse(rows: { key: string; value: string }[]): Prefs {
  const out: Prefs = { ...DEFAULT_PREFS };
  for (const r of rows) {
    if (!r.key.startsWith(PREFIX)) continue;
    const k = r.key.slice(PREFIX.length) as keyof Prefs;
    if (!(k in out)) continue;
    try {
      (out as Record<string, unknown>)[k] = JSON.parse(r.value);
    } catch {
      // ignore corrupt values, keep default
    }
  }
  return out;
}

export function getPrefs(): Prefs {
  return parse(db.select().from(settings).all());
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  const k = PREFIX + key;
  const v = JSON.stringify(value);
  db.insert(settings)
    .values({ key: k, value: v })
    .onConflictDoUpdate({ target: settings.key, set: { value: v } })
    .run();
}

export function deletePref(key: keyof Prefs): void {
  db.delete(settings)
    .where(eq(settings.key, PREFIX + key))
    .run();
}

/** Live preferences; screens re-render when a preference changes. */
export function usePrefs(): Prefs {
  const { data } = useLiveData<{ key: string; value: string }>(db.select().from(settings));
  return parse(data);
}
