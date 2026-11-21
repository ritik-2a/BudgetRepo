import type { Account } from '@/db/schema';

import { computeBalances } from '../repo';

jest.mock('@/db/client', () => ({ db: {} }));

const base = {
  creditLimit: null,
  statementDay: null,
  dueDay: null,
  icon: null,
  color: null,
  sortOrder: 0,
  archived: false,
  createdAt: 0,
  updatedAt: 0,
  deleted: false,
};
const bank: Account = { ...base, id: 'bank', name: 'Bank', type: 'bank', openingBalance: 10000000 };
const card: Account = {
  ...base,
  id: 'card',
  name: 'Card',
  type: 'credit_card',
  openingBalance: 500000,
  creditLimit: 15000000,
};

describe('computeBalances', () => {
  it('does not double count a credit-card bill payment', () => {
    // Salary 80k into bank; 20k spent on card; 10k SIP from bank; 25k bill paid bank -> card.
    const flows = [
      { accountId: 'bank', type: 'income', total: 8000000 },
      { accountId: 'card', type: 'expense', total: 2000000 },
      { accountId: 'bank', type: 'investment', total: 1000000 },
      { accountId: 'bank', type: 'transfer', total: 2500000 },
    ];
    const transfersIn = [{ accountId: 'card', total: 2500000 }];
    const [b, c] = computeBalances([bank, card], flows, transfersIn);

    // Bank: 1,00,000 + 80,000 − 10,000 − 25,000 = 1,45,000
    expect(b.balance).toBe(14500000);
    // Card: 5,000 opening owed + 20,000 spent − 25,000 paid = 0 outstanding
    expect(c.outstanding).toBe(0);
    expect(c.balance).toBe(-0);
  });

  it('shows a card credit when overpaid', () => {
    const [c] = computeBalances([card], [], [{ accountId: 'card', total: 600000 }]);
    expect(c.outstanding).toBe(-100000);
  });
});
