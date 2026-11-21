import { getCardCycle } from './billing-cycle';
import { cardStatement } from './commute';

export type CardTx = {
  type: string;
  amount: number;
  date: string;
  accountId: string;
  toAccountId: string | null;
};

export type CardDues = {
  /** Last generated bill (opening outstanding + spends up to the statement date − credits). */
  statement: number;
  /** Part of that bill still unpaid. */
  billToPay: number;
  dueDate: string;
  daysToDue: number;
  /** Spends in the open cycle (goes on the next bill). */
  nextBillSoFar: number;
  /** Date the next bill is generated. */
  nextStatementDate: string;
  nextDueDate: string;
};

/**
 * Splits a credit card's dues into the bill already generated (to pay now) and the
 * next bill building up in the current cycle.
 */
export function computeCardDues(
  card: { id: string; openingBalance: number; statementDay: number; dueDay: number },
  txs: CardTx[],
  today = new Date(),
): CardDues {
  const cycle = getCardCycle(card.statementDay, card.dueDay, today);
  let spendToStatement = 0;
  let creditsToStatement = 0;
  let paidAfterStatement = 0;
  let nextBillSoFar = 0;

  for (const t of txs) {
    const outOfCard = t.accountId === card.id && t.type !== 'income';
    const intoCard =
      (t.toAccountId === card.id && t.type === 'transfer') ||
      (t.accountId === card.id && t.type === 'income');
    const beforeStatement = t.date <= cycle.lastEnd;
    if (outOfCard) {
      if (beforeStatement) spendToStatement += t.amount;
      else nextBillSoFar += t.amount;
    } else if (intoCard) {
      if (beforeStatement) creditsToStatement += t.amount;
      else paidAfterStatement += t.amount;
    }
  }

  const { statement, dueRemaining } = cardStatement({
    opening: card.openingBalance,
    spendToStatement,
    creditsToStatement,
    paidAfterStatement,
  });

  return {
    statement,
    billToPay: dueRemaining,
    dueDate: cycle.dueDate,
    daysToDue: cycle.daysToDue,
    nextBillSoFar,
    nextStatementDate: cycle.currentEnd,
    nextDueDate: cycle.nextDueDate,
  };
}
