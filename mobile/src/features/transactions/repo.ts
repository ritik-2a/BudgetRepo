import { and, between, desc, eq, like, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';

import { db } from '@/db/client';
import {
  accounts,
  categories,
  funds,
  transactions,
  type Transaction,
  type TransactionType,
} from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { newId } from '@/lib/id';

export type TransactionInput = {
  type: TransactionType;
  amount: number;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  fundId?: string | null;
  date: string;
  note?: string | null;
  recurringRuleId?: string | null;
};

/** Normalises fields that don't apply to the chosen type. */
function clean(t: TransactionInput): TransactionInput {
  return {
    ...t,
    toAccountId: t.type === 'transfer' ? (t.toAccountId ?? null) : null,
    categoryId: t.type === 'transfer' ? null : (t.categoryId ?? null),
    fundId: t.type === 'investment' ? (t.fundId ?? null) : null,
    note: t.note?.trim() ? t.note.trim() : null,
  };
}

export function createTransaction(t: TransactionInput): string {
  const id = newId();
  db.insert(transactions)
    .values({ id, ...clean(t) })
    .run();
  return id;
}

export function updateTransaction(id: string, t: TransactionInput): void {
  db.update(transactions)
    .set({ ...clean(t), updatedAt: Date.now() })
    .where(eq(transactions.id, id))
    .run();
}

/** Soft delete (kept for sync/undo). */
export function deleteTransaction(id: string): void {
  db.update(transactions)
    .set({ deleted: true, updatedAt: Date.now() })
    .where(eq(transactions.id, id))
    .run();
}

export function restoreTransaction(id: string): void {
  db.update(transactions)
    .set({ deleted: false, updatedAt: Date.now() })
    .where(eq(transactions.id, id))
    .run();
}

export function getTransaction(id: string): Transaction | undefined {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.deleted, false)))
    .get();
}

const toAccount = alias(accounts, 'to_account');
const parentCategory = alias(categories, 'parent_category');

/** Transaction row joined with display info. */
export type TxRow = {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  note: string | null;
  accountId: string;
  accountName: string | null;
  accountType: string | null;
  toAccountId: string | null;
  toAccountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  parentCategoryName: string | null;
  fundId: string | null;
  fundName: string | null;
  createdAt: number;
};

const rowSelection = {
  id: transactions.id,
  type: transactions.type,
  amount: transactions.amount,
  date: transactions.date,
  note: transactions.note,
  accountId: transactions.accountId,
  accountName: accounts.name,
  accountType: accounts.type,
  toAccountId: transactions.toAccountId,
  toAccountName: toAccount.name,
  categoryId: transactions.categoryId,
  categoryName: categories.name,
  categoryIcon: categories.icon,
  categoryColor: categories.color,
  parentCategoryName: parentCategory.name,
  fundId: transactions.fundId,
  fundName: funds.name,
  createdAt: transactions.createdAt,
};

export type TxFilter = {
  start: string;
  end: string;
  type?: TransactionType | 'all';
  accountId?: string | null;
  categoryId?: string | null;
  fundId?: string | null;
  search?: string;
  limit?: number;
};

function buildTxQuery(f: TxFilter) {
  const conds = [eq(transactions.deleted, false), between(transactions.date, f.start, f.end)];
  if (f.type && f.type !== 'all') conds.push(eq(transactions.type, f.type));
  if (f.accountId) {
    conds.push(
      or(eq(transactions.accountId, f.accountId), eq(transactions.toAccountId, f.accountId))!,
    );
  }
  if (f.categoryId) {
    conds.push(
      or(eq(transactions.categoryId, f.categoryId), eq(categories.parentId, f.categoryId))!,
    );
  }
  if (f.fundId) conds.push(eq(transactions.fundId, f.fundId));
  const q = f.search?.trim();
  if (q) {
    const pattern = `%${q.replace(/[%_]/g, '')}%`;
    conds.push(
      or(
        like(transactions.note, pattern),
        like(categories.name, pattern),
        like(accounts.name, pattern),
        like(funds.name, pattern),
      )!,
    );
  }

  const query = db
    .select(rowSelection)
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(toAccount, eq(transactions.toAccountId, toAccount.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(parentCategory, eq(categories.parentId, parentCategory.id))
    .leftJoin(funds, eq(transactions.fundId, funds.id))
    .where(and(...conds))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));

  return f.limit ? query.limit(f.limit) : query;
}

export function useTransactions(f: TxFilter) {
  return useLiveData<TxRow>(buildTxQuery(f), [
    f.start,
    f.end,
    f.type,
    f.accountId,
    f.categoryId,
    f.fundId,
    f.search,
    f.limit,
  ]);
}

export function listTransactions(f: TxFilter): TxRow[] {
  return buildTxQuery(f).all() as TxRow[];
}

/** Display title for a transaction row. */
export function txTitle(t: TxRow): string {
  if (t.type === 'transfer') {
    return t.toAccountName ? `${t.accountName ?? 'Account'} → ${t.toAccountName}` : 'Transfer';
  }
  if (t.type === 'investment') return t.fundName ?? t.categoryName ?? 'Investment';
  return t.categoryName ?? 'Uncategorised';
}

/** Sum by type over a date range (transfers excluded from spending). */
export function totalsQuery(start: string, end: string) {
  return db
    .select({
      type: transactions.type,
      total: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(transactions)
    .where(and(between(transactions.date, start, end), eq(transactions.deleted, false)))
    .groupBy(transactions.type);
}
