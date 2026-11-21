import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { categories, transactions } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { todayISO } from '@/lib/dates';

import { createTransaction } from '../transactions/repo';
import { getPrefs, setPref, type CommutePrefs } from '../settings/repo';

export const DEFAULT_COMMUTE: Omit<CommutePrefs, 'metroAccountId'> = {
  fare: 3870,
  tripsPerDay: 2,
  workDays: [1, 2, 3, 4, 5],
  overrides: {},
};

/** The "Metro" category (child of Travel) used for commute trips. */
export function getMetroCategoryId(): string | null {
  return (
    db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.name, 'Metro'), eq(categories.deleted, false)))
      .get()?.id ?? null
  );
}

export function saveCommute(c: CommutePrefs): void {
  setPref('commute', c);
  // Keep the Metro quick-add button in step with the fare.
  const metroId = getMetroCategoryId();
  if (metroId) {
    db.update(categories)
      .set({ quickAmount: c.fare, updatedAt: Date.now() })
      .where(eq(categories.id, metroId))
      .run();
  }
}

/** Marks a date as no-travel (or clears the mark). */
export function toggleDayOff(iso: string): boolean {
  const c = getPrefs().commute;
  if (!c) return false;
  const overrides = { ...c.overrides };
  const nowOff = overrides[iso] !== 'off';
  if (nowOff) overrides[iso] = 'off';
  else delete overrides[iso];
  // Forget marks older than ~2 months.
  const cutoff = new Date(Date.now() - 62 * 86_400_000).toISOString().slice(0, 10);
  for (const k of Object.keys(overrides)) if (k < cutoff) delete overrides[k];
  setPref('commute', { ...c, overrides });
  return nowOff;
}

/** Logs `trips` metro trips today from the metro card. Returns created ids. */
export function logMetroTrips(trips: number, c: CommutePrefs): string[] {
  const categoryId = getMetroCategoryId();
  const ids: string[] = [];
  for (let i = 0; i < trips; i++) {
    ids.push(
      createTransaction({
        type: 'expense',
        amount: c.fare,
        accountId: c.metroAccountId,
        categoryId,
        date: todayISO(),
        note: trips === 2 ? (i === 0 ? 'To office' : 'Back home') : null,
      }),
    );
  }
  return ids;
}

/** Metro trips (from the metro card) per date in [start, end]. */
export function useMetroTripsByDay(metroAccountId: string | null, start: string, end: string) {
  return useLiveData<{ date: string; trips: number }>(
    db
      .select({ date: transactions.date, trips: sql<number>`count(*)` })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.deleted, false),
          eq(transactions.type, 'expense'),
          eq(transactions.accountId, metroAccountId ?? '__none__'),
          eq(categories.name, 'Metro'),
          sql`${transactions.date} between ${start} and ${end}`,
        ),
      )
      .groupBy(transactions.date),
    [metroAccountId, start, end],
  );
}
