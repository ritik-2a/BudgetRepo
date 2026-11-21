import { cardStatement, forecastCommute, weekDays, type CommuteConfig } from '../commute';
import { toISODate } from '../dates';

const cfg: CommuteConfig = { fare: 3870, tripsPerDay: 2, workDays: [1, 2, 3, 4, 5], overrides: {} };

describe('forecastCommute', () => {
  // Sun 22 Nov 2026
  const sunday = new Date(2026, 10, 22);

  it('converts the metro card balance into trips and office days', () => {
    const f = forecastCommute(63250, cfg, sunday);
    expect(f.tripsLeft).toBe(16); // 632.50 / 38.70
    expect(f.officeDaysLeft).toBe(8);
    // Mon 23 … Fri 27 (5 days) + Mon 30, Tue 1, Wed 2 (3 days) = 8 → recharge before Thu 3 Dec
    expect(toISODate(f.rechargeBy!)).toBe('2026-12-03');
    expect(f.shortThisWeek).toBe(0);
  });

  it('pushes the recharge date out when days are marked off', () => {
    const f = forecastCommute(
      63250,
      { ...cfg, overrides: { '2026-11-25': 'off', '2026-11-27': 'off' } },
      sunday,
    );
    expect(toISODate(f.rechargeBy!)).toBe('2026-12-07');
  });

  it('accounts for trips already taken today', () => {
    const monday = new Date(2026, 10, 23);
    // ₹77.40 left = 2 trips; one trip done today → 1 needed today, leaving 1 trip,
    // which can't cover Tuesday's round trip → recharge by Tuesday.
    const f = forecastCommute(7740, cfg, monday, 1);
    expect(f.tripsLeft).toBe(2);
    expect(toISODate(f.rechargeBy!)).toBe('2026-11-24');
  });

  it('reports the shortfall for the current week', () => {
    const monday = new Date(2026, 10, 23);
    const f = forecastCommute(10000, cfg, monday); // 5 days × 2 × 38.70 = 387.00
    expect(f.shortThisWeek).toBe(38700 - 10000);
  });

  it('shows the coming week on weekends', () => {
    expect(weekDays(new Date(2026, 10, 22), [1, 2, 3, 4, 5]).map(toISODate)[0]).toBe('2026-11-23');
    expect(weekDays(new Date(2026, 10, 21), [1, 2, 3, 4, 5]).map(toISODate)[0]).toBe('2026-11-23');
  });

  it('lists the work days of the week', () => {
    expect(weekDays(new Date(2026, 10, 25), [1, 2, 3, 4, 5]).map(toISODate)).toEqual([
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
    ]);
  });
});

describe('cardStatement', () => {
  it('includes the outstanding entered when the card was added', () => {
    expect(
      cardStatement({
        opening: 882482,
        spendToStatement: 0,
        creditsToStatement: 0,
        paidAfterStatement: 0,
      }),
    ).toEqual({ statement: 882482, dueRemaining: 882482 });
  });
  it('subtracts payments made after the statement', () => {
    expect(
      cardStatement({
        opening: 0,
        spendToStatement: 500000,
        creditsToStatement: 20000,
        paidAfterStatement: 300000,
      }),
    ).toEqual({ statement: 480000, dueRemaining: 180000 });
  });
});
