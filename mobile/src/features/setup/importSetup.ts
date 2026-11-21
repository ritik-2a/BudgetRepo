/**
 * One-shot setup import: accounts (matched by name), categories, funds, past transactions,
 * recurring items, the commute planner, and final balances. Used by the clayfin://import
 * deep link, which always shows a preview the user must confirm. Everything runs in one
 * database transaction, so a failure changes nothing.
 */
import { and, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import {
  accounts,
  categories,
  funds,
  type AccountType,
  type CategoryKind,
  type TransactionType,
} from '@/db/schema';
import { todayISO } from '@/lib/dates';
import { firstOccurrence } from '@/lib/recurrence';

import {
  ACCOUNT_TYPE_META,
  createAccount,
  getAccount,
  openingForTarget,
  updateAccount,
} from '../accounts/repo';
import { createCategory } from '../categories/repo';
import { DEFAULT_COMMUTE, saveCommute } from '../commute/repo';
import { createFund, updateFund } from '../funds/repo';
import { createRule, type RuleMode } from '../recurring/repo';
import { getPrefs } from '../settings/repo';
import { createTransaction } from '../transactions/repo';

export type SetupPayload = {
  v: 1;
  accounts?: {
    name: string;
    type: AccountType;
    /** Current balance (paise); for credit cards: current outstanding. */
    balance: number;
    statementDay?: number;
    dueDay?: number;
    creditLimit?: number;
  }[];
  categories?: {
    name: string;
    kind: CategoryKind;
    icon: string;
    color: string;
    /** Parent category name */
    parent?: string;
  }[];
  funds?: { name: string; sipAmount?: number; sipDay?: number }[];
  transactions?: {
    type: TransactionType;
    amount: number;
    date: string;
    account: string;
    toAccount?: string;
    category?: string;
    fund?: string;
    note?: string;
  }[];
  recurring?: {
    label: string;
    type: TransactionType;
    /** 0 = amount varies (asks each month) */
    amount: number;
    account: string;
    category?: string;
    fund?: string;
    day: number;
    mode: RuleMode;
    /** First occurrence on/after this date (default: today) */
    from?: string;
    note?: string;
  }[];
  salary?: { amount: number; day: number; accountName: string };
  commute?: { metroAccountName: string; fare: number; tripsPerDay?: number; workDays?: number[] };
  /** Applied last: what each account should show now (keeps imported history intact). */
  finalBalances?: { account: string; balance: number }[];
};

export function decodePayload(d: string): SetupPayload {
  const b64 = d.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    Array.from(atob(b64), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
  );
  const p = JSON.parse(json) as SetupPayload;
  if (p?.v !== 1) throw new Error('Unsupported setup file');
  return p;
}

function accountByName(name: string) {
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.name, name), eq(accounts.deleted, false)))
    .get();
}
function requireAccount(name: string) {
  const a = accountByName(name);
  if (!a) throw new Error(`Account "${name}" not found`);
  return a;
}
function categoryByName(name: string) {
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.name, name), eq(categories.deleted, false)))
    .get();
}
function fundByName(name: string) {
  return db
    .select()
    .from(funds)
    .where(and(eq(funds.name, name), eq(funds.deleted, false)))
    .get();
}

export function applySetup(p: SetupPayload): string[] {
  const log: string[] = [];
  db.transaction(() => {
    for (const a of p.accounts ?? []) {
      const existing = accountByName(a.name);
      const meta = ACCOUNT_TYPE_META[a.type];
      const input = {
        name: a.name,
        type: a.type,
        openingBalance: openingForTarget(existing?.id ?? null, a.type, a.balance),
        creditLimit: a.creditLimit ?? existing?.creditLimit ?? null,
        statementDay: a.statementDay ?? existing?.statementDay ?? null,
        dueDay: a.dueDay ?? existing?.dueDay ?? null,
        icon: existing?.icon ?? meta.icon,
        color: existing?.color ?? meta.color,
      };
      if (existing) updateAccount(existing.id, input);
      else createAccount(input);
      log.push(`${existing ? 'Updated' : 'Added'} ${a.name}`);
    }

    for (const c of p.categories ?? []) {
      if (categoryByName(c.name)) continue;
      const parent = c.parent ? categoryByName(c.parent) : undefined;
      createCategory({ ...c, parentId: parent?.id ?? null });
      log.push(`Category ${c.name}`);
    }

    for (const f of p.funds ?? []) {
      const existing = fundByName(f.name);
      if (existing) {
        updateFund(existing.id, {
          name: existing.name,
          sipAmount: f.sipAmount ?? existing.sipAmount,
          sipDay: f.sipDay ?? existing.sipDay,
          currentValue: existing.currentValue,
          currentValueDate: existing.currentValueDate,
        });
      } else {
        createFund({ name: f.name, sipAmount: f.sipAmount ?? null, sipDay: f.sipDay ?? null });
      }
      log.push(`${existing ? 'Updated' : 'Added'} fund ${f.name}`);
    }

    for (const t of p.transactions ?? []) {
      createTransaction({
        type: t.type,
        amount: t.amount,
        date: t.date,
        accountId: requireAccount(t.account).id,
        toAccountId: t.toAccount ? requireAccount(t.toAccount).id : null,
        categoryId: t.category ? (categoryByName(t.category)?.id ?? null) : null,
        fundId: t.fund ? (fundByName(t.fund)?.id ?? null) : null,
        note: t.note ?? null,
      });
    }
    if (p.transactions?.length) log.push(`${p.transactions.length} transactions`);

    for (const r of p.recurring ?? []) {
      createRule({
        template: {
          type: r.type,
          amount: r.amount,
          accountId: requireAccount(r.account).id,
          categoryId: r.category ? (categoryByName(r.category)?.id ?? null) : null,
          fundId: r.fund ? (fundByName(r.fund)?.id ?? null) : null,
          note: r.note ?? null,
        },
        day: r.day,
        nextRun: firstOccurrence(r.from ?? todayISO(), 'monthly', r.day),
        mode: r.mode,
      });
      log.push(r.label);
    }

    if (p.salary) {
      const acc = accountByName(p.salary.accountName);
      if (acc) {
        createRule({
          template: {
            type: 'income',
            amount: p.salary.amount,
            accountId: acc.id,
            categoryId: categoryByName('Salary')?.id ?? null,
            note: 'Salary',
          },
          day: p.salary.day,
          nextRun: firstOccurrence(todayISO(), 'monthly', p.salary.day),
          mode: 'remind_only',
        });
        log.push(`Salary reminder from day ${p.salary.day}`);
      }
    }

    if (p.commute) {
      const card = accountByName(p.commute.metroAccountName);
      if (card) {
        saveCommute({
          metroAccountId: card.id,
          fare: p.commute.fare,
          tripsPerDay: p.commute.tripsPerDay ?? DEFAULT_COMMUTE.tripsPerDay,
          workDays: p.commute.workDays ?? DEFAULT_COMMUTE.workDays,
          overrides: getPrefs().commute?.overrides ?? {},
        });
        log.push('Commute planner set up');
      }
    }

    for (const b of p.finalBalances ?? []) {
      const a = requireAccount(b.account);
      const fresh = getAccount(a.id)!;
      updateAccount(a.id, {
        name: fresh.name,
        type: fresh.type,
        openingBalance: openingForTarget(a.id, fresh.type, b.balance),
        creditLimit: fresh.creditLimit,
        statementDay: fresh.statementDay,
        dueDay: fresh.dueDay,
        icon: fresh.icon,
        color: fresh.color,
      });
    }
    if (p.finalBalances?.length) log.push('Balances kept as entered');
  });
  return log;
}
