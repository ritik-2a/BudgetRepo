/**
 * Database schema (SQLite via Drizzle). See PLAN.md §4.
 *
 * Conventions:
 *  - ids are UUID strings (sync-safe).
 *  - money columns are integer paise.
 *  - dates are "YYYY-MM-DD" strings; timestamps are epoch milliseconds.
 *  - every table carries `updatedAt` + `deleted` (soft delete) for the Phase 4 cloud sync.
 *
 * After changing this file run `npm run db:generate` to create a migration.
 */
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const syncColumns = {
  createdAt: integer('created_at')
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  deleted: integer('deleted', { mode: 'boolean' }).notNull().default(false),
};

export const ACCOUNT_TYPES = [
  'bank',
  'credit_card',
  'cash',
  'wallet',
  'metro_card',
  'receivable',
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ACCOUNT_TYPES }).notNull(),
  openingBalance: integer('opening_balance').notNull().default(0),
  /** Credit cards only */
  creditLimit: integer('credit_limit'),
  /** Credit cards only: day of month (1–31) the statement is generated */
  statementDay: integer('statement_day'),
  /** Credit cards only: day of month (1–31) payment is due */
  dueDay: integer('due_day'),
  icon: text('icon'),
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  ...syncColumns,
});

export const CATEGORY_KINDS = ['expense', 'income', 'investment'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: CATEGORY_KINDS }).notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  parentId: text('parent_id'),
  /** Quick-add default fare/amount in paise (used by Auto/Metro buttons) */
  quickAmount: integer('quick_amount'),
  sortOrder: integer('sort_order').notNull().default(0),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  ...syncColumns,
});

export const TRANSACTION_TYPES = ['expense', 'income', 'investment', 'transfer'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    type: text('type', { enum: TRANSACTION_TYPES }).notNull(),
    /** Always positive; the type decides the direction. */
    amount: integer('amount').notNull(),
    accountId: text('account_id').notNull(),
    /** Transfers only (e.g. Bank -> Credit Card bill payment) */
    toAccountId: text('to_account_id'),
    categoryId: text('category_id'),
    /** Investments only */
    fundId: text('fund_id'),
    date: text('date').notNull(),
    note: text('note'),
    recurringRuleId: text('recurring_rule_id'),
    /** Links the parts of one split bill (my share + friends' shares). */
    splitGroup: text('split_group'),
    ...syncColumns,
  },
  (t) => [
    index('tx_date_idx').on(t.date),
    index('tx_account_date_idx').on(t.accountId, t.date),
    index('tx_category_date_idx').on(t.categoryId, t.date),
    index('tx_type_date_idx').on(t.type, t.date),
  ],
);

export const budgets = sqliteTable(
  'budgets',
  {
    id: text('id').primaryKey(),
    /** null = overall monthly budget */
    categoryId: text('category_id'),
    /** "YYYY-MM" */
    month: text('month').notNull(),
    limitAmount: integer('limit_amount').notNull(),
    ...syncColumns,
  },
  (t) => [index('budget_month_idx').on(t.month)],
);

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetAmount: integer('target_amount').notNull(),
  targetDate: text('target_date'),
  savedAmount: integer('saved_amount').notNull().default(0),
  linkedAccountId: text('linked_account_id'),
  linkedFundId: text('linked_fund_id'),
  icon: text('icon'),
  color: text('color'),
  ...syncColumns,
});

export const funds = sqliteTable('funds', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sipAmount: integer('sip_amount'),
  sipDay: integer('sip_day'),
  /** Optional manually-entered current value (no live NAV tracking) */
  currentValue: integer('current_value'),
  currentValueDate: text('current_value_date'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  ...syncColumns,
});

export const recurringRules = sqliteTable('recurring_rules', {
  id: text('id').primaryKey(),
  /** JSON of the transaction fields to create */
  template: text('template', { mode: 'json' }).notNull(),
  frequency: text('frequency', { enum: ['monthly', 'weekly'] }).notNull(),
  /** Day of month (monthly) or weekday 0–6 (weekly) */
  day: integer('day').notNull(),
  nextRun: text('next_run').notNull(),
  mode: text('mode', { enum: ['auto_create', 'remind_only'] }).notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  ...syncColumns,
});

export const reminders = sqliteTable('reminders', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['daily_log', 'bill_due', 'sip', 'custom'] }).notNull(),
  /** "HH:mm" */
  time: text('time').notNull(),
  title: text('title'),
  accountId: text('account_id'),
  fundId: text('fund_id'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  ...syncColumns,
});

/** Key/value app settings (e.g. seeded flag, preferences). */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Fund = typeof funds.$inferSelect;
