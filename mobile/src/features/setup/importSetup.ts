/**
 * One-shot setup import: creates/updates accounts (by name), funds, recurring salary and the
 * commute planner from a JSON payload. Used by the clayfin://import deep link, which always
 * shows a preview the user must confirm.
 */
import { and, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { accounts, categories, funds, type AccountType } from '@/db/schema';
import { todayISO } from '@/lib/dates';
import { firstOccurrence } from '@/lib/recurrence';

import {
  ACCOUNT_TYPE_META,
  createAccount,
  openingForTarget,
  updateAccount,
} from '../accounts/repo';
import { DEFAULT_COMMUTE, saveCommute } from '../commute/repo';
import { createFund, updateFund } from '../funds/repo';
import { createRule } from '../recurring/repo';
import { getPrefs } from '../settings/repo';

export type SetupPayload = {
  v: 1;
  accounts?: {
    name: string;
    /** If set, an existing account with this name is renamed/updated instead of creating one. */
    match?: string;
    type: AccountType;
    /** Current balance (paise); for credit cards: current outstanding. */
    balance: number;
    statementDay?: number;
    dueDay?: number;
    creditLimit?: number;
  }[];
  funds?: { name: string; sipAmount?: number; sipDay?: number }[];
  salary?: { amount: number; day: number; accountName: string };
  commute?: { metroAccountName: string; fare: number; tripsPerDay?: number; workDays?: number[] };
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

function findAccountByName(name: string) {
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.name, name), eq(accounts.deleted, false)))
    .get();
}

export function applySetup(p: SetupPayload): string[] {
  const log: string[] = [];
  db.transaction(() => {
    for (const a of p.accounts ?? []) {
      const existing = findAccountByName(a.match ?? a.name) ?? findAccountByName(a.name);
      const meta = ACCOUNT_TYPE_META[a.type];
      const input = {
        name: a.name,
        type: a.type,
        openingBalance: openingForTarget(existing?.id ?? null, a.type, a.balance),
        creditLimit: a.creditLimit ?? existing?.creditLimit ?? null,
        statementDay: a.statementDay ?? null,
        dueDay: a.dueDay ?? null,
        icon: existing?.icon ?? meta.icon,
        color: existing?.color ?? meta.color,
      };
      if (existing) {
        updateAccount(existing.id, input);
        log.push(`Updated ${a.name}`);
      } else {
        createAccount(input);
        log.push(`Added ${a.name}`);
      }
    }

    for (const f of p.funds ?? []) {
      const existing = db
        .select()
        .from(funds)
        .where(and(eq(funds.name, f.name), eq(funds.deleted, false)))
        .get();
      const input = { name: f.name, sipAmount: f.sipAmount ?? null, sipDay: f.sipDay ?? null };
      if (existing) updateFund(existing.id, { ...existing, ...input });
      else createFund(input);
      log.push(`${existing ? 'Updated' : 'Added'} fund ${f.name}`);
    }

    if (p.salary) {
      const acc = findAccountByName(p.salary.accountName);
      const salaryCat = db
        .select()
        .from(categories)
        .where(and(eq(categories.name, 'Salary'), eq(categories.deleted, false)))
        .get();
      if (acc) {
        createRule({
          template: {
            type: 'income',
            amount: p.salary.amount,
            accountId: acc.id,
            categoryId: salaryCat?.id ?? null,
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
      const card = findAccountByName(p.commute.metroAccountName);
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
  });
  return log;
}
