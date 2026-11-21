import { addDays, clampedDate, fromISODate, toISODate } from './dates';

export type Frequency = 'monthly' | 'weekly';

/**
 * Next occurrence strictly after `afterISO`.
 * monthly: `day` is 1–31 (clamped to month length). weekly: `day` is 0 (Sun) – 6 (Sat).
 */
export function nextOccurrence(afterISO: string, frequency: Frequency, day: number): string {
  const after = fromISODate(afterISO);
  if (frequency === 'weekly') {
    const delta = (day - after.getDay() + 7) % 7 || 7;
    return toISODate(addDays(after, delta));
  }
  const sameMonth = clampedDate(after.getFullYear(), after.getMonth(), day);
  if (sameMonth > after) return toISODate(sameMonth);
  return toISODate(clampedDate(after.getFullYear(), after.getMonth() + 1, day));
}

/** First occurrence on or after `fromISO`. */
export function firstOccurrence(fromISO: string, frequency: Frequency, day: number): string {
  return nextOccurrence(toISODate(addDays(fromISODate(fromISO), -1)), frequency, day);
}

/**
 * All occurrences from `nextRunISO` up to and including `todayISO`, plus the new
 * next-run date after them. Capped to avoid runaway loops after long gaps.
 */
export function dueOccurrences(
  nextRunISO: string,
  todayISO: string,
  frequency: Frequency,
  day: number,
  cap = 24,
): { dates: string[]; nextRun: string } {
  const dates: string[] = [];
  let cursor = nextRunISO;
  while (cursor <= todayISO && dates.length < cap) {
    dates.push(cursor);
    cursor = nextOccurrence(cursor, frequency, day);
  }
  return { dates, nextRun: cursor };
}
