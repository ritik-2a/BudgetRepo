import { addMonths, fromISODate } from './dates';

/** Months (rounded up, min 1) from `from` until the target date. */
export function monthsUntil(targetISO: string, from = new Date()): number {
  const t = fromISODate(targetISO);
  const months = (t.getFullYear() - from.getFullYear()) * 12 + (t.getMonth() - from.getMonth());
  return Math.max(1, months);
}

export type GoalProjection = {
  remaining: number;
  percent: number;
  /** Paise per month needed to hit the target date (null without a target date). */
  requiredPerMonth: number | null;
  /** Month the goal is reached at `monthlyPace` (null if pace ≤ 0 or already done). */
  projectedDate: Date | null;
  onTrack: boolean | null;
};

export function projectGoal(
  target: number,
  saved: number,
  targetDateISO: string | null,
  monthlyPace: number,
  today = new Date(),
): GoalProjection {
  const remaining = Math.max(0, target - saved);
  const percent = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  const requiredPerMonth =
    targetDateISO && remaining > 0
      ? Math.ceil(remaining / monthsUntil(targetDateISO, today))
      : null;
  const projectedDate =
    remaining > 0 && monthlyPace > 0 ? addMonths(today, Math.ceil(remaining / monthlyPace)) : null;
  const onTrack =
    remaining === 0
      ? true
      : targetDateISO && projectedDate
        ? projectedDate <= fromISODate(targetDateISO)
        : targetDateISO
          ? false
          : null;
  return { remaining, percent, requiredPerMonth, projectedDate, onTrack };
}
