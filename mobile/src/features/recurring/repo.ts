import { and, asc, eq, lte } from 'drizzle-orm';

import { db } from '@/db/client';
import { recurringRules } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { todayISO } from '@/lib/dates';
import { newId } from '@/lib/id';
import { dueOccurrences, firstOccurrence, nextOccurrence, type Frequency } from '@/lib/recurrence';

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

/** Remind-only rules whose date has arrived (e.g. salary expected from the 7th). */
export function useDueReminders(today = todayISO()) {
  const q = useRules();
  return {
    ...q,
    data: q.data.filter((r) => r.enabled && r.mode === 'remind_only' && r.nextRun <= today),
  };
}

/** Logs a due item today (the day it actually happened) and moves the rule to next month. */
export function completeDueRule(rule: RecurringRule, amount = rule.template.amount): string {
  let id = '';
  db.transaction((tx) => {
    id = createTransaction({
      ...rule.template,
      amount,
      date: todayISO(),
      recurringRuleId: rule.id,
    });
    tx.update(recurringRules)
      .set({
        nextRun: nextOccurrence(rule.nextRun, rule.frequency, rule.day),
        updatedAt: Date.now(),
      })
      .where(eq(recurringRules.id, rule.id))
      .run();
  });
  return id;
}

/** Skips this occurrence without logging anything. */
export function skipDueRule(rule: RecurringRule): void {
  db.update(recurringRules)
    .set({ nextRun: nextOccurrence(rule.nextRun, rule.frequency, rule.day), updatedAt: Date.now() })
    .where(eq(recurringRules.id, rule.id))
    .run();
}

/** Creates a rule from scratch (used by setup import). */
export function createRule(input: {
  template: RuleTemplate;
  day: number;
  nextRun: string;
  mode: RuleMode;
}): string {
  const id = newId();
  db.insert(recurringRules)
    .values({
      id,
      template: input.template,
      frequency: 'monthly',
      day: input.day,
      nextRun: input.nextRun,
      mode: input.mode,
    })
    .run();
  return id;
}

/** Moves a rule to its next occurrence (after logging this one some other way). */
export function advanceRuleById(id: string): void {
  const r = db.select().from(recurringRules).where(eq(recurringRules.id, id)).get();
  if (!r) return;
  skipDueRule(toRule(r));
}

/** Changes the day of month; the next occurrence is recalculated from today. */
export function setRuleDay(id: string, day: number): void {
  db.update(recurringRules)
    .set({ day, nextRun: firstOccurrence(todayISO(), 'monthly', day), updatedAt: Date.now() })
    .where(eq(recurringRules.id, id))
    .run();
}
