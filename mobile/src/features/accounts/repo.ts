import { and, asc, eq, sql } from 'drizzle-orm';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { accounts, transactions, type Account, type AccountType } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { newId } from '@/lib/id';

export type AccountInput = {
  name: string;
  type: AccountType;
  openingBalance: number;
  creditLimit?: number | null;
  statementDay?: number | null;
  dueDay?: number | null;
  icon?: string | null;
  color?: string | null;
};

export const ACCOUNT_TYPE_META: Record<
  AccountType,
  { label: string; icon: string; color: string }
> = {
  bank: { label: 'Bank account', icon: 'business', color: '#5B50E6' },
  credit_card: { label: 'Credit card', icon: 'card', color: '#C2417F' },
  cash: { label: 'Cash', icon: 'wallet', color: '#2BB389' },
  wallet: { label: 'Wallet / UPI', icon: 'phone-portrait', color: '#3D8BEB' },
  metro_card: { label: 'Metro card', icon: 'train', color: '#3FA7D6' },
  receivable: { label: 'Money owed to me', icon: 'people', color: '#F0A43A' },
};

export function validateAccount(a: AccountInput): Partial<Record<keyof AccountInput, string>> {
  const e: Partial<Record<keyof AccountInput, string>> = {};
  if (!a.name.trim()) e.name = 'Enter a name';
  if (a.type === 'credit_card') {
    const okDay = (d: number | null | undefined) => !!d && d >= 1 && d <= 31;
    if (!okDay(a.statementDay)) e.statementDay = 'Day 1–31';
    if (!okDay(a.dueDay)) e.dueDay = 'Day 1–31';
  }
  return e;
}

export function createAccount(a: AccountInput): string {
  const id = newId();
  const maxOrder = db
    .select({ m: sql<number>`coalesce(max(${accounts.sortOrder}), -1)` })
    .from(accounts)
    .get();
  const meta = ACCOUNT_TYPE_META[a.type];
  db.insert(accounts)
    .values({
      id,
      ...a,
      name: a.name.trim(),
      icon: a.icon ?? meta.icon,
      color: a.color ?? meta.color,
      sortOrder: (maxOrder?.m ?? -1) + 1,
    })
    .run();
  return id;
}

export function updateAccount(id: string, a: AccountInput): void {
  db.update(accounts)
    .set({ ...a, name: a.name.trim(), updatedAt: Date.now() })
    .where(eq(accounts.id, id))
    .run();
}

export function setAccountArchived(id: string, archived: boolean): void {
  db.update(accounts).set({ archived, updatedAt: Date.now() }).where(eq(accounts.id, id)).run();
}

export function getAccount(id: string): Account | undefined {
  return db.select().from(accounts).where(eq(accounts.id, id)).get();
}

export function countAccountTransactions(id: string): number {
  const r = db
    .select({ n: sql<number>`count(*)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.deleted, false),
        sql`(${transactions.accountId} = ${id} or ${transactions.toAccountId} = ${id})`,
      ),
    )
    .get();
  return r?.n ?? 0;
}

/** Live list of accounts (active first, then archived when `includeArchived`). */
export function useAccounts(includeArchived = false) {
  return useLiveData<Account>(
    db
      .select()
      .from(accounts)
      .where(
        includeArchived
          ? eq(accounts.deleted, false)
          : and(eq(accounts.deleted, false), eq(accounts.archived, false)),
      )
      .orderBy(asc(accounts.archived), asc(accounts.sortOrder)),
    [includeArchived],
  );
}

/** Current balance of one account (same rules as useAccountBalances). */
export function getAccountBalance(id: string): AccountWithBalance | undefined {
  const account = getAccount(id);
  if (!account) return undefined;
  const flows = db
    .select({
      accountId: transactions.accountId,
      type: transactions.type,
      total: sql<number>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(and(eq(transactions.deleted, false), eq(transactions.accountId, id)))
    .groupBy(transactions.accountId, transactions.type)
    .all();
  const transfersIn = db
    .select({
      accountId: transactions.toAccountId,
      total: sql<number>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.deleted, false),
        eq(transactions.type, 'transfer'),
        eq(transactions.toAccountId, id),
      ),
    )
    .groupBy(transactions.toAccountId)
    .all();
  return computeBalances([account], flows, transfersIn)[0];
}

/**
 * Opening balance that makes the account show `target` *now* (balance, or outstanding
 * for a credit card), keeping existing transactions intact.
 */
export function openingForTarget(id: string | null, type: AccountType, target: number): number {
  if (!id) return target;
  const current = getAccountBalance(id);
  if (!current) return target;
  if (type === 'credit_card') return current.openingBalance + (target - current.outstanding);
  return current.openingBalance + (target - current.balance);
}

type FlowRow = { accountId: string; type: string; total: number };
type InRow = { accountId: string | null; total: number };

/**
 * Account balances.
 *  - Normal accounts: opening + income + transfers in − expenses − investments − transfers out.
 *  - Credit cards: `outstanding` = opening (owed) + spends − payments/refunds; `balance` = −outstanding.
 */
export type AccountWithBalance = Account & { balance: number; outstanding: number };

export function useAccountBalances(includeArchived = false) {
  const accountsQ = useAccounts(includeArchived);
  const outQ = useLiveData<FlowRow>(
    db
      .select({
        accountId: transactions.accountId,
        type: transactions.type,
        total: sql<number>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .where(eq(transactions.deleted, false))
      .groupBy(transactions.accountId, transactions.type),
  );
  const inQ = useLiveData<InRow>(
    db
      .select({
        accountId: transactions.toAccountId,
        total: sql<number>`sum(${transactions.amount})`,
      })
      .from(transactions)
      .where(and(eq(transactions.deleted, false), eq(transactions.type, 'transfer')))
      .groupBy(transactions.toAccountId),
  );

  const data = useMemo(
    () => computeBalances(accountsQ.data, outQ.data, inQ.data),
    [accountsQ.data, outQ.data, inQ.data],
  );

  return {
    data,
    loading: accountsQ.loading || outQ.loading || inQ.loading,
    error: accountsQ.error ?? outQ.error ?? inQ.error,
  };
}

export function computeBalances(
  list: Account[],
  flows: FlowRow[],
  transfersIn: InRow[],
): AccountWithBalance[] {
  return list.map((a) => {
    let inflow = 0;
    let outflow = 0;
    for (const f of flows) {
      if (f.accountId !== a.id) continue;
      if (f.type === 'income') inflow += f.total;
      else outflow += f.total; // expense, investment, transfer out
    }
    for (const t of transfersIn) if (t.accountId === a.id) inflow += t.total;

    if (a.type === 'credit_card') {
      const outstanding = a.openingBalance + outflow - inflow;
      return { ...a, outstanding, balance: -outstanding };
    }
    const balance = a.openingBalance + inflow - outflow;
    return { ...a, balance, outstanding: 0 };
  });
}
