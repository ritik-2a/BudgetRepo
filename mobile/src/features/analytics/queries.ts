import { and, between, eq, gt, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { categories, transactions } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { addMonths, formatMonthShort, monthRange, toMonthKey } from '@/lib/dates';

const parent = alias(categories, 'parent');

export type MonthRow = {
  key: string; // YYYY-MM
  label: string; // "Nov"
  income: number;
  spent: number;
  invested: number;
};

/** Income / spent / invested per month for the `count` months ending at `end`. */
export function useMonthlyTotals(end: Date, count = 6) {
  const first = addMonths(end, -(count - 1));
  const firstKey = toMonthKey(first);
  const start = monthRange(first).start;
  const last = monthRange(end).end;
  const q = useLiveData<{ month: string; type: string; total: number }>(
    db
      .select({
        month: sql<string>`substr(${transactions.date}, 1, 7)`,
        type: transactions.type,
        total: sql<number>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .where(and(eq(transactions.deleted, false), between(transactions.date, start, last)))
      .groupBy(sql`substr(${transactions.date}, 1, 7)`, transactions.type),
    [start, last],
  );

  const data = useMemo<MonthRow[]>(() => {
    const rows: MonthRow[] = [];
    for (let i = 0; i < count; i++) {
      const d = addMonths(first, i);
      const key = toMonthKey(d);
      const get = (type: string) =>
        q.data.find((r) => r.month === key && r.type === type)?.total ?? 0;
      rows.push({
        key,
        label: formatMonthShort(d),
        income: get('income'),
        spent: get('expense'),
        invested: get('investment'),
      });
    }
    return rows;
    // `first` is fully described by firstKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, count, firstKey]);

  return { data, loading: q.loading, error: q.error };
}

export type CategorySpend = {
  id: string;
  name: string;
  color: string;
  icon: string;
  total: number;
  count: number;
};

/** Expense totals per top-level category (children roll up into the parent). */
export function useSpendByCategory(start: string, end: string, accountId?: string | null) {
  const conds = [
    eq(transactions.deleted, false),
    eq(transactions.type, 'expense'),
    between(transactions.date, start, end),
  ];
  if (accountId) conds.push(eq(transactions.accountId, accountId));
  return useLiveData<CategorySpend>(
    db
      .select({
        id: sql<string>`coalesce(${parent.id}, ${categories.id}, 'none')`,
        name: sql<string>`coalesce(${parent.name}, ${categories.name}, 'Uncategorised')`,
        color: sql<string>`coalesce(${parent.color}, ${categories.color}, '#9AA0B5')`,
        icon: sql<string>`coalesce(${parent.icon}, ${categories.icon}, 'pricetag')`,
        total: sql<number>`sum(${transactions.amount})`,
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(parent, eq(categories.parentId, parent.id))
      .where(and(...conds))
      .groupBy(sql`coalesce(${parent.id}, ${categories.id}, 'none')`),
    [start, end, accountId],
  );
}

/** Spend per child category of `parentName` (e.g. Travel → Auto / Metro / Cab / Fuel). */
export function useChildSpend(parentName: string, start: string, end: string) {
  return useLiveData<CategorySpend>(
    db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        icon: categories.icon,
        total: sql<number>`sum(${transactions.amount})`,
        count: sql<number>`count(*)`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(parent, eq(categories.parentId, parent.id))
      .where(
        and(
          eq(transactions.deleted, false),
          eq(transactions.type, 'expense'),
          between(transactions.date, start, end),
          sql`(${parent.name} = ${parentName} or ${categories.name} = ${parentName})`,
        ),
      )
      .groupBy(categories.id),
    [parentName, start, end],
  );
}

/** Monthly spend for one top-level category over `count` months. */
export function useCategoryTrend(parentName: string, end: Date, count = 6) {
  const first = addMonths(end, -(count - 1));
  const firstKey = toMonthKey(first);
  const start = monthRange(first).start;
  const last = monthRange(end).end;
  const q = useLiveData<{ month: string; total: number }>(
    db
      .select({
        month: sql<string>`substr(${transactions.date}, 1, 7)`,
        total: sql<number>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(parent, eq(categories.parentId, parent.id))
      .where(
        and(
          eq(transactions.deleted, false),
          eq(transactions.type, 'expense'),
          between(transactions.date, start, last),
          sql`(${parent.name} = ${parentName} or ${categories.name} = ${parentName})`,
        ),
      )
      .groupBy(sql`substr(${transactions.date}, 1, 7)`),
    [parentName, start, last],
  );
  const data = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const d = addMonths(first, i);
        return {
          label: formatMonthShort(d),
          value: q.data.find((r) => r.month === toMonthKey(d))?.total ?? 0,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.data, count, firstKey],
  );
  return { data, loading: q.loading, error: q.error };
}

/** Card activity for the billing-cycle dashboard. */
export function useCardActivity(cardId: string, lastStart: string, lastEnd: string) {
  return useLiveData<{
    statementSpend: number;
    statementRefunds: number;
    paidSinceStatement: number;
    currentSpend: number;
  }>(
    db
      .select({
        statementSpend: sql<number>`coalesce(sum(case when ${transactions.accountId} = ${cardId} and ${transactions.type} in ('expense','investment','transfer') and ${transactions.date} between ${lastStart} and ${lastEnd} then ${transactions.amount} end), 0)`,
        statementRefunds: sql<number>`coalesce(sum(case when ${transactions.accountId} = ${cardId} and ${transactions.type} = 'income' and ${transactions.date} between ${lastStart} and ${lastEnd} then ${transactions.amount} end), 0)`,
        paidSinceStatement: sql<number>`coalesce(sum(case when ${transactions.toAccountId} = ${cardId} and ${transactions.type} = 'transfer' and ${transactions.date} > ${lastEnd} then ${transactions.amount} end), 0)`,
        currentSpend: sql<number>`coalesce(sum(case when ${transactions.accountId} = ${cardId} and ${transactions.type} = 'expense' and ${transactions.date} > ${lastEnd} then ${transactions.amount} end), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.deleted, false)),
    [cardId, lastStart, lastEnd],
  );
}

/** Average monthly net savings (income − spending) over the last `months` full months. */
export function useSavingsPace(months = 3) {
  const now = new Date();
  const start = monthRange(addMonths(now, -months)).start;
  const end = monthRange(addMonths(now, -1)).end;
  const q = useLiveData<{ type: string; total: number }>(
    db
      .select({ type: transactions.type, total: sql<number>`sum(${transactions.amount})` })
      .from(transactions)
      .where(
        and(
          eq(transactions.deleted, false),
          between(transactions.date, start, end),
          gt(transactions.amount, 0),
        ),
      )
      .groupBy(transactions.type),
    [start, end],
  );
  const income = q.data.find((r) => r.type === 'income')?.total ?? 0;
  const spent = q.data.find((r) => r.type === 'expense')?.total ?? 0;
  return { pace: Math.round((income - spent) / months), loading: q.loading };
}
