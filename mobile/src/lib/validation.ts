import type { TransactionType } from '@/db/schema';

export type TransactionDraft = {
  type: TransactionType;
  amount: number | null;
  accountId: string | null;
  toAccountId?: string | null;
  categoryId?: string | null;
  fundId?: string | null;
  date: string;
};

export type DraftErrors = Partial<Record<keyof TransactionDraft, string>>;

const MAX_AMOUNT = 100_00_00_000_00; // ₹100 crore in paise

/** Returns field → message for every problem; empty object when valid. */
export function validateTransaction(d: TransactionDraft): DraftErrors {
  const e: DraftErrors = {};
  if (d.amount === null || !Number.isFinite(d.amount)) e.amount = 'Enter an amount';
  else if (d.amount <= 0) e.amount = 'Amount must be greater than ₹0';
  else if (d.amount > MAX_AMOUNT) e.amount = 'Amount is too large';

  if (!d.accountId) {
    e.accountId = d.type === 'transfer' ? 'Choose where the money comes from' : 'Choose an account';
  }

  if (d.type === 'transfer') {
    if (!d.toAccountId) e.toAccountId = 'Choose where the money goes';
    else if (d.toAccountId === d.accountId) e.toAccountId = 'Pick two different accounts';
  } else if (d.type === 'investment') {
    if (!d.fundId && !d.categoryId) e.fundId = 'Choose a fund';
  } else if (!d.categoryId) {
    e.categoryId = 'Choose a category';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) e.date = 'Choose a valid date';
  return e;
}

export function isValid(errors: object): boolean {
  return Object.keys(errors).length === 0;
}
