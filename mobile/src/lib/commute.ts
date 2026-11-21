import { addDays, toISODate } from './dates';

/** Days the user marked as no-travel (WFH, leave, holiday). Keyed by "YYYY-MM-DD". */
export type CommuteOverrides = Record<string, 'off'>;

export type CommuteConfig = {
  /** One-way fare in paise. */
  fare: number;
  /** Trips per office day (2 = there and back). */
  tripsPerDay: number;
  /** Weekdays you normally travel: 0 = Sun … 6 = Sat. */
  workDays: number[];
  overrides: CommuteOverrides;
};

export function isOfficeDay(d: Date, cfg: Pick<CommuteConfig, 'workDays' | 'overrides'>): boolean {
  return cfg.workDays.includes(d.getDay()) && cfg.overrides[toISODate(d)] !== 'off';
}

export type CommuteForecast = {
  /** Whole one-way trips the balance covers. */
  tripsLeft: number;
  /** Full office days (round trips) the balance covers. */
  officeDaysLeft: number;
  /** First office day the card can't fully cover (recharge before this), or null if > 90 days. */
  rechargeBy: Date | null;
  /** Amount needed to cover the rest of the current week's office days. */
  shortThisWeek: number;
};

/**
 * Forecasts how far the metro card balance goes.
 * `todayTripsDone` = trips already logged today (they're already out of the balance).
 */
export function forecastCommute(
  balance: number,
  cfg: CommuteConfig,
  today = new Date(),
  todayTripsDone = 0,
): CommuteForecast {
  const fare = Math.max(1, cfg.fare);
  const tripsLeft = Math.max(0, Math.floor(balance / fare));
  const perDay = Math.max(1, cfg.tripsPerDay);
  const officeDaysLeft = Math.floor(tripsLeft / perDay);

  // Walk forward through office days spending trips until the balance runs out.
  let trips = tripsLeft;
  let rechargeBy: Date | null = null;
  let needThisWeek = 0;
  const endOfWeek = addDays(today, 6 - today.getDay());
  for (let i = 0; i < 90; i++) {
    const d = addDays(today, i);
    if (!isOfficeDay(d, cfg)) continue;
    const need = i === 0 ? Math.max(0, perDay - todayTripsDone) : perDay;
    if (d <= endOfWeek) needThisWeek += need;
    if (trips >= need) {
      trips -= need;
    } else if (!rechargeBy) {
      rechargeBy = d;
    }
  }
  const shortThisWeek = Math.max(0, needThisWeek * fare - balance);
  return { tripsLeft, officeDaysLeft, rechargeBy, shortThisWeek };
}

/**
 * Travel days (configured work days) of the week containing `d`. Once they're all over
 * (e.g. on Saturday/Sunday) it returns the coming week instead.
 */
export function weekDays(d: Date, workDays: number[]): Date[] {
  const days = (anchor: Date) => {
    const monday = addDays(anchor, -((anchor.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((x) =>
      workDays.includes(x.getDay()),
    );
  };
  const thisWeek = days(d);
  const todayIso = toISODate(d);
  return thisWeek.length && thisWeek.every((x) => toISODate(x) < todayIso)
    ? days(addDays(d, 7))
    : thisWeek;
}

/**
 * Credit-card statement maths: what the last bill was and how much of it is still due.
 * `opening` is the outstanding entered when the card was added (treated as part of the bill).
 */
export function cardStatement(input: {
  opening: number;
  spendToStatement: number;
  creditsToStatement: number;
  paidAfterStatement: number;
}): { statement: number; dueRemaining: number } {
  const statement = Math.max(0, input.opening + input.spendToStatement - input.creditsToStatement);
  return { statement, dueRemaining: Math.max(0, statement - input.paidAfterStatement) };
}
