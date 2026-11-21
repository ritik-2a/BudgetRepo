import { and, between, eq, isNull, sql } from 'drizzle-orm';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { budgets, categories, transactions, type Budget, type Category } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { fromISODate, monthRange, toMonthKey } from '@/lib/dates';
import { newId } from '@/lib/id';
import { formatINR } from '@/lib/money';

/** Expense spend in a date range grouped by top-level category (children roll up). */
function spendByRootQuery(start: string, end: string) {
  return db
    .select({
      rootId: sql<string>`coalesce(${categories.parentId}, ${transactions.categoryId})`,
      total: sql<number>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.deleted, false),
        eq(transactions.type, 'expense'),
        between(transactions.date, start, end),
      ),
    )
    .groupBy(sql`coalesce(${categories.parentId}, ${transactions.categoryId})`);
}

export type BudgetLine = {
  budget: Budget;
  category: Category | null; // null = overall
  spent: number;
  ratio: number;
  remaining: number;
};

export type BudgetStatus = {
  overall: BudgetLine | null;
  lines: BudgetLine[];
  totalSpent: number;
  /** Spend per root category (for categories without budgets too). */
  spendByRoot: Map<string, number>;
};

export function useBudgetStatus(month: Date) {
  const key = toMonthKey(month);
  const { start, end } = monthRange(month);
  const budgetsQ = useLiveData<Budget>(
    db
      .select()
      .from(budgets)
      .where(and(eq(budgets.deleted, false), eq(budgets.month, key))),
    [key],
  );
  const spendQ = useLiveData<{ rootId: string; total: number }>(spendByRootQuery(start, end), [
    start,
    end,
  ]);
  const catsQ = useLiveData<Category>(
    db.select().from(categories).where(eq(categories.deleted, false)),
  );

  const data = useMemo<BudgetStatus>(() => {
    const spendByRoot = new Map(spendQ.data.map((r) => [r.rootId, r.total]));
    const totalSpent = spendQ.data.reduce((s, r) => s + r.total, 0);
    const line = (b: Budget): BudgetLine => {
      const category = b.categoryId
        ? (catsQ.data.find((c) => c.id === b.categoryId) ?? null)
        : null;
      const spent = b.categoryId ? (spendByRoot.get(b.categoryId) ?? 0) : totalSpent;
      return {
        budget: b,
        category,
        spent,
        ratio: b.limitAmount > 0 ? spent / b.limitAmount : 0,
        remaining: b.limitAmount - spent,
      };
    };
    const overallB = budgetsQ.data.find((b) => !b.categoryId);
    return {
      overall: overallB ? line(overallB) : null,
      lines: budgetsQ.data
        .filter((b) => b.categoryId)
        .map(line)
        .sort((a, b) => b.ratio - a.ratio),
      totalSpent,
      spendByRoot,
    };
  }, [budgetsQ.data, spendQ.data, catsQ.data]);

  return {
    data,
    loading: budgetsQ.loading || spendQ.loading || catsQ.loading,
    error: budgetsQ.error ?? spendQ.error ?? catsQ.error,
  };
}

/** Insert or update the budget for (month, category). `categoryId` null = overall. */
export function setBudget(month: string, categoryId: string | null, limitAmount: number): void {
  const existing = db
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.month, month),
        categoryId ? eq(budgets.categoryId, categoryId) : isNull(budgets.categoryId),
      ),
    )
    .get();
  if (existing) {
    db.update(budgets)
      .set({ limitAmount, deleted: false, updatedAt: Date.now() })
      .where(eq(budgets.id, existing.id))
      .run();
  } else {
    db.insert(budgets).values({ id: newId(), month, categoryId, limitAmount }).run();
  }
}

export function deleteBudget(id: string): void {
  db.update(budgets).set({ deleted: true, updatedAt: Date.now() }).where(eq(budgets.id, id)).run();
}

/** Copies the previous month's budgets into `month` (skips ones that already exist). */
export function copyBudgetsFromPreviousMonth(month: Date): number {
  const prev = toMonthKey(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const key = toMonthKey(month);
  const source = db
    .select()
    .from(budgets)
    .where(and(eq(budgets.month, prev), eq(budgets.deleted, false)))
    .all();
  const current = db
    .select()
    .from(budgets)
    .where(and(eq(budgets.month, key), eq(budgets.deleted, false)))
    .all();
  let copied = 0;
  for (const b of source) {
    if (current.some((c) => c.categoryId === b.categoryId)) continue;
    setBudget(key, b.categoryId, b.limitAmount);
    copied++;
  }
  return copied;
}

export type BudgetAlert = { tone: 'warning' | 'error'; title: string; message: string };

/**
 * After saving an expense, returns alerts for any budget whose usage crossed 80% or 100%
 * because of this expense.
 */
export function budgetAlertsAfterExpense(
  categoryId: string | null,
  dateISO: string,
  amount: number,
): BudgetAlert[] {
  const month = fromISODate(dateISO);
  const key = toMonthKey(month);
  const { start, end } = monthRange(month);
  const monthBudgets = db
    .select()
    .from(budgets)
    .where(and(eq(budgets.month, key), eq(budgets.deleted, false)))
    .all();
  if (monthBudgets.length === 0) return [];

  const spend = spendByRootQuery(start, end).all();
  const total = spend.reduce((s, r) => s + r.total, 0);
  const cat = categoryId
    ? db.select().from(categories).where(eq(categories.id, categoryId)).get()
    : undefined;
  const rootId = cat?.parentId ?? cat?.id ?? null;
  const rootName = cat?.parentId
    ? db.select().from(categories).where(eq(categories.id, cat.parentId)).get()?.name
    : cat?.name;

  const alerts: BudgetAlert[] = [];
  const check = (limit: number, after: number, label: string) => {
    const before = after - amount;
    if (before < limit && after >= limit) {
      alerts.push({
        tone: 'error',
        title: `${label} budget exceeded`,
        message: `Spent ${formatINR(after)} of ${formatINR(limit)} this month.`,
      });
    } else if (before < limit * 0.8 && after >= limit * 0.8) {
      alerts.push({
        tone: 'warning',
        title: `${label} budget at ${Math.round((after / limit) * 100)}%`,
        message: `${formatINR(limit - after)} left of ${formatINR(limit)} this month.`,
      });
    }
  };

  const catBudget = rootId ? monthBudgets.find((b) => b.categoryId === rootId) : undefined;
  if (catBudget) {
    check(
      catBudget.limitAmount,
      spend.find((s) => s.rootId === rootId)?.total ?? 0,
      rootName ?? 'Category',
    );
  }
  const overall = monthBudgets.find((b) => !b.categoryId);
  if (overall) check(overall.limitAmount, total, 'Monthly');
  return alerts;
}
