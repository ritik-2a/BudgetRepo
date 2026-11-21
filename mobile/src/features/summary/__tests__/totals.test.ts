import { toMonthTotals } from '../queries';

jest.mock('@/db/client', () => ({}));

describe('toMonthTotals', () => {
  it('maps grouped rows to income/spent/invested', () => {
    expect(
      toMonthTotals([
        { type: 'income', total: 8000000, count: 1 },
        { type: 'expense', total: 2500000, count: 12 },
        { type: 'investment', total: 1500000, count: 2 },
      ]),
    ).toEqual({ income: 8000000, spent: 2500000, invested: 1500000, count: 15 });
  });

  it('returns zeros for an empty month', () => {
    expect(toMonthTotals([])).toEqual({ income: 0, spent: 0, invested: 0, count: 0 });
  });
});
