import { addDays, clampedDate, daysBetween, toISODate } from './dates';

/**
 * Credit-card billing cycle maths.
 *
 * The statement is generated on `statementDay` each month and includes every
 * purchase from the day after the previous statement up to and including the
 * statement day. Payment is due on `dueDay`: in the same month if dueDay is after
 * statementDay, otherwise in the following month.
 */
export type CardCycle = {
  /** Current (open) cycle: purchases here go on the NEXT bill. */
  currentStart: string;
  currentEnd: string;
  /** Last generated statement period. */
  lastStart: string;
  lastEnd: string;
  /** Due date of the last statement. */
  dueDate: string;
  /** Days from today until `dueDate` (negative if overdue). */
  daysToDue: number;
  /** Due date of the bill for the current cycle. */
  nextDueDate: string;
};

function statementDate(year: number, monthIndex: number, statementDay: number): Date {
  return clampedDate(year, monthIndex, statementDay);
}

function dueDateFor(statement: Date, statementDay: number, dueDay: number): Date {
  const offset = dueDay > statementDay ? 0 : 1;
  return clampedDate(statement.getFullYear(), statement.getMonth() + offset, dueDay);
}

export function getCardCycle(statementDay: number, dueDay: number, today = new Date()): CardCycle {
  const y = today.getFullYear();
  const m = today.getMonth();
  const thisMonthStatement = statementDate(y, m, statementDay);

  // If today is on/before this month's statement date, that statement is still open.
  const nextStatement =
    daysBetween(today, thisMonthStatement) >= 0
      ? thisMonthStatement
      : statementDate(y, m + 1, statementDay);
  const lastStatement = statementDate(
    nextStatement.getFullYear(),
    nextStatement.getMonth() - 1,
    statementDay,
  );
  const prevStatement = statementDate(
    lastStatement.getFullYear(),
    lastStatement.getMonth() - 1,
    statementDay,
  );

  const due = dueDateFor(lastStatement, statementDay, dueDay);
  const nextDue = dueDateFor(nextStatement, statementDay, dueDay);

  return {
    currentStart: toISODate(addDays(lastStatement, 1)),
    currentEnd: toISODate(nextStatement),
    lastStart: toISODate(addDays(prevStatement, 1)),
    lastEnd: toISODate(lastStatement),
    dueDate: toISODate(due),
    daysToDue: daysBetween(today, due),
    nextDueDate: toISODate(nextDue),
  };
}

/** The next `count` due dates on or after today (used for reminders). */
export function upcomingDueDates(
  statementDay: number,
  dueDay: number,
  count: number,
  today = new Date(),
): Date[] {
  const out: Date[] = [];
  for (let i = -1; out.length < count && i < count + 2; i++) {
    const stmt = statementDate(today.getFullYear(), today.getMonth() + i, statementDay);
    const due = dueDateFor(stmt, statementDay, dueDay);
    if (daysBetween(today, due) >= 0) out.push(due);
  }
  return out;
}
