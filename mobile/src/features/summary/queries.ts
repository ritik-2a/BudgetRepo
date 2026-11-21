import { and, between, eq, ne, sql } from 'drizzle-orm';

import type { DB } from '@/db/client';
import { transactions } from '@/db/schema';

/** Income / spent / invested totals (paise) for a date range, transfers excluded. */
export function monthTotalsQuery(db: DB, start: string, end: string) {
  return db
    .select({
      type: transactions.type,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(
      and(
        between(transactions.date, start, end),
        eq(transactions.deleted, false),
        ne(transactions.type, 'transfer'),
      ),
    )
    .groupBy(transactions.type);
}

export type MonthTotals = { income: number; spent: number; invested: number; count: number };

export function toMonthTotals(rows: { type: string; total: number; count: number }[]): MonthTotals {
  const out: MonthTotals = { income: 0, spent: 0, invested: 0, count: 0 };
  for (const r of rows) {
    if (r.type === 'income') out.income = r.total;
    else if (r.type === 'expense') out.spent = r.total;
    else if (r.type === 'investment') out.invested = r.total;
    out.count += r.count;
  }
  return out;
}
