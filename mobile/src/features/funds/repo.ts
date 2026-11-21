import { and, asc, eq, sql } from 'drizzle-orm';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { funds, transactions, type Fund } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { newId } from '@/lib/id';

export type FundInput = {
  name: string;
  sipAmount?: number | null;
  sipDay?: number | null;
  currentValue?: number | null;
  currentValueDate?: string | null;
};

export function validateFund(f: FundInput): Partial<Record<keyof FundInput, string>> {
  const e: Partial<Record<keyof FundInput, string>> = {};
  if (!f.name.trim()) e.name = 'Enter the fund name';
  if (f.sipDay != null && (f.sipDay < 1 || f.sipDay > 31)) e.sipDay = 'Day 1–31';
  if (f.sipAmount != null && f.sipAmount <= 0) e.sipAmount = 'Must be more than ₹0';
  return e;
}

export function createFund(f: FundInput): string {
  const id = newId();
  db.insert(funds)
    .values({ id, ...f, name: f.name.trim() })
    .run();
  return id;
}

export function updateFund(id: string, f: FundInput): void {
  db.update(funds)
    .set({ ...f, name: f.name.trim(), updatedAt: Date.now() })
    .where(eq(funds.id, id))
    .run();
}

export function setFundArchived(id: string, archived: boolean): void {
  db.update(funds).set({ archived, updatedAt: Date.now() }).where(eq(funds.id, id)).run();
}

export function getFund(id: string): Fund | undefined {
  return db.select().from(funds).where(eq(funds.id, id)).get();
}

export function useFunds(includeArchived = false) {
  return useLiveData<Fund>(
    db
      .select()
      .from(funds)
      .where(
        includeArchived
          ? eq(funds.deleted, false)
          : and(eq(funds.deleted, false), eq(funds.archived, false)),
      )
      .orderBy(asc(funds.archived), asc(funds.name)),
    [includeArchived],
  );
}

export type FundWithTotals = Fund & {
  invested: number;
  investedThisMonth: number;
  lastInvested: string | null;
  gain: number | null;
};

/** Funds joined with how much has been invested (all time and in `month` range). */
export function useFundTotals(monthStart: string, monthEnd: string, includeArchived = false) {
  const fundsQ = useFunds(includeArchived);
  const totalsQ = useLiveData<{
    fundId: string | null;
    total: number;
    month: number;
    last: string | null;
  }>(
    db
      .select({
        fundId: transactions.fundId,
        total: sql<number>`sum(${transactions.amount})`,
        month: sql<number>`coalesce(sum(case when ${transactions.date} between ${monthStart} and ${monthEnd} then ${transactions.amount} end), 0)`,
        last: sql<string | null>`max(${transactions.date})`,
      })
      .from(transactions)
      .where(and(eq(transactions.deleted, false), eq(transactions.type, 'investment')))
      .groupBy(transactions.fundId),
    [monthStart, monthEnd],
  );

  const data = useMemo<FundWithTotals[]>(
    () =>
      fundsQ.data.map((f) => {
        const t = totalsQ.data.find((r) => r.fundId === f.id);
        const invested = t?.total ?? 0;
        return {
          ...f,
          invested,
          investedThisMonth: t?.month ?? 0,
          lastInvested: t?.last ?? null,
          gain: f.currentValue != null ? f.currentValue - invested : null,
        };
      }),
    [fundsQ.data, totalsQ.data],
  );

  return { data, loading: fundsQ.loading || totalsQ.loading, error: fundsQ.error ?? totalsQ.error };
}
