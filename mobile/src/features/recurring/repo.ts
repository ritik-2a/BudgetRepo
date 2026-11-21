import { and, asc, eq, lte } from 'drizzle-orm';

import { db } from '@/db/client';
import { recurringRules } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { todayISO } from '@/lib/dates';
import { newId } from '@/lib/id';
import { dueOccurrences, nextOccurrence, type Frequency } from '@/lib/recurrence';

import { createTransaction, type TransactionInput } from '../transactions/repo';

export type RuleTemplate = Omit<TransactionInput, 'date' | 'recurringRuleId'>;
export type RuleMode = 'auto_create' | 'remind_only';

export type RecurringRule = {
  id: string;
  template: RuleTemplate;
  frequency: Frequency;
  day: number;
  nextRun: string;
  mode: RuleMode;
  enabled: boolean;
};

function toRule(r: typeof recurringRules.$inferSelect): RecurringRule {
  return {
    id: r.id,
    template: r.template as RuleTemplate,
    frequency: r.frequency,
    day: r.day,
    nextRun: r.nextRun,
    mode: r.mode,
    enabled: r.enabled,
  };
}

/** Creates a monthly rule from a transaction that was just saved on `fromDate`. */
export function createRuleFromTransaction(
  t: TransactionInput,
  mode: RuleMode = 'auto_create',
): string {
  const id = newId();
  const day = Number(t.date.slice(8, 10));
  const { date: _date, recurringRuleId: _r, ...template } = t;
  db.insert(recurringRules)
    .values({
      id,
      template,
      frequency: 'monthly',
      day,
      nextRun: nextOccurrence(t.date, 'monthly', day),
      mode,
    })
    .run();
  return id;
}

export function updateRule(id: string, patch: Partial<Pick<RecurringRule, 'mode' | 'enabled'>>) {
  db.update(recurringRules)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(recurringRules.id, id))
    .run();
}

export function deleteRule(id: string): void {
  db.update(recurringRules)
    .set({ deleted: true, updatedAt: Date.now() })
    .where(eq(recurringRules.id, id))
    .run();
}

export function useRules() {
  const q = useLiveData<typeof recurringRules.$inferSelect>(
    db
      .select()
      .from(recurringRules)
      .where(eq(recurringRules.deleted, false))
      .orderBy(asc(recurringRules.nextRun)),
  );
  return { ...q, data: q.data.map(toRule) };
}

export function listActiveRules(): RecurringRule[] {
  return db
    .select()
    .from(recurringRules)
    .where(and(eq(recurringRules.deleted, false), eq(recurringRules.enabled, true)))
    .all()
    .map(toRule);
}

/**
 * Creates transactions for every auto-create rule occurrence that is due (including
 * ones missed while the app was closed) and advances each rule. Returns how many
 * transactions were created.
 */
export function processDueRules(today = todayISO()): number {
  const due = db
    .select()
    .from(recurringRules)
    .where(
      and(
        eq(recurringRules.deleted, false),
        eq(recurringRules.enabled, true),
        lte(recurringRules.nextRun, today),
      ),
    )
    .all()
    .map(toRule);

  let created = 0;
  for (const rule of due) {
    const { dates, nextRun } = dueOccurrences(rule.nextRun, today, rule.frequency, rule.day);
    db.transaction((tx) => {
      if (rule.mode === 'auto_create') {
        for (const date of dates) {
          createTransaction({ ...rule.template, date, recurringRuleId: rule.id });
          created++;
        }
      }
      tx.update(recurringRules)
        .set({ nextRun, updatedAt: Date.now() })
        .where(eq(recurringRules.id, rule.id))
        .run();
    });
  }
  return created;
}
