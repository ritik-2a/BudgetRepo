import { computeCardDues, type CardTx } from '../card-dues';

const card = { id: 'axis', openingBalance: 0, statementDay: 13, dueDay: 3 };
const today = new Date(2026, 10, 22); // 22 Nov 2026
const spend = (amount: number, date: string): CardTx => ({
  type: 'expense',
  amount,
  date,
  accountId: 'axis',
  toAccountId: null,
});

describe('computeCardDues', () => {
  it('separates the generated bill from the next bill', () => {
    const d = computeCardDues(
      card,
      [
        spend(500000, '2026-11-13'), // on the statement date → this bill
        spend(49600, '2026-11-22'),
        spend(44700, '2026-11-22'),
        // paid for a friend on the card → still on the next bill
        {
          type: 'transfer',
          amount: 20700,
          date: '2026-11-22',
          accountId: 'axis',
          toAccountId: 'suhani',
        },
      ],
      today,
    );
    expect(d.billToPay).toBe(500000);
    expect(d.dueDate).toBe('2026-12-03');
    expect(d.daysToDue).toBe(11);
    expect(d.nextBillSoFar).toBe(115000);
    expect(d.nextStatementDate).toBe('2026-12-13');
  });

  it('includes the outstanding entered when the card was added', () => {
    const d = computeCardDues({ ...card, openingBalance: 300000 }, [], today);
    expect(d.billToPay).toBe(300000);
  });

  it('reduces the bill by payments made after the statement', () => {
    const d = computeCardDues(
      card,
      [
        spend(500000, '2026-11-10'),
        {
          type: 'transfer',
          amount: 200000,
          date: '2026-11-20',
          accountId: 'bank',
          toAccountId: 'axis',
        },
      ],
      today,
    );
    expect(d.statement).toBe(500000);
    expect(d.billToPay).toBe(300000);
  });
});
