import { db } from '@/db/client';
import { newId } from '@/lib/id';
import type { SplitResult } from '@/lib/split';

import { getAccount } from '../accounts/repo';
import { createTransaction, type TransactionInput } from '../transactions/repo';

/**
 * Saves a split bill atomically.
 *  - I paid (bank/card/UPI): my share is an expense from that account; each friend's share
 *    is a transfer from that account to the friend (they now owe me).
 *  - A friend paid: only my share is recorded, as an expense from the friend's IOU account
 *    (I now owe them).
 * All parts share one splitGroup id so they can be deleted together.
 */
export function createSplitBill(
  bill: TransactionInput,
  split: Extract<SplitResult, { ok: true }>,
  label: string,
): { group: string; parts: number } {
  const group = newId();
  const payer = getAccount(bill.accountId);
  const friendPaid = payer?.type === 'receivable';
  let parts = 0;

  db.transaction(() => {
    if (split.mine > 0) {
      createTransaction({
        ...bill,
        amount: split.mine,
        splitGroup: group,
        note: bill.note?.trim() || `${label} (my share)`,
      });
      parts++;
    }
    if (!friendPaid) {
      for (const s of split.shares) {
        if (s.personId === bill.accountId) continue;
        const person = getAccount(s.personId);
        createTransaction({
          type: 'transfer',
          amount: s.amount,
          accountId: bill.accountId,
          toAccountId: s.personId,
          date: bill.date,
          note: `${label}: ${person?.name ?? 'friend'}'s share`,
          splitGroup: group,
        });
        parts++;
      }
    }
  });
  return { group, parts };
}
