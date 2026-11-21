import { and, eq, inArray, or } from 'drizzle-orm';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { useLiveData } from '@/db/useLiveData';
import { computeCardDues, type CardDues, type CardTx } from '@/lib/card-dues';

import { useAccountBalances, type AccountWithBalance } from './repo';

export type CardWithDues = { card: AccountWithBalance; dues: CardDues };

/** Every credit card (with billing days) split into "bill to pay" and "next bill so far". */
export function useCardDues() {
  const balances = useAccountBalances();
  const cards = balances.data.filter(
    (a) => a.type === 'credit_card' && a.statementDay && a.dueDay && !a.archived,
  );
  const ids = cards.map((c) => c.id);
  const key = ids.join(',');
  const q = useLiveData<CardTx>(
    db
      .select({
        type: transactions.type,
        amount: transactions.amount,
        date: transactions.date,
        accountId: transactions.accountId,
        toAccountId: transactions.toAccountId,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.deleted, false),
          or(
            inArray(transactions.accountId, ids.length ? ids : ['__none__']),
            inArray(transactions.toAccountId, ids.length ? ids : ['__none__']),
          ),
        ),
      ),
    [key],
  );

  const data = useMemo<CardWithDues[]>(
    () =>
      cards.map((card) => ({
        card,
        dues: computeCardDues(
          {
            id: card.id,
            openingBalance: card.openingBalance,
            statementDay: card.statementDay!,
            dueDay: card.dueDay!,
          },
          q.data,
        ),
      })),
    // cards is derived from balances.data
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [balances.data, q.data],
  );

  return { data, loading: balances.loading || q.loading, balances: balances.data };
}
