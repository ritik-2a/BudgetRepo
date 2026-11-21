import { getCardCycle, upcomingDueDates } from '../billing-cycle';
import { toCSV } from '../csv';
import { clampedDate, formatDayHeader, ordinal, toISODate } from '../dates';
import { projectGoal } from '../projection';
import { dueOccurrences, firstOccurrence, nextOccurrence } from '../recurrence';
import { validateTransaction } from '../validation';

describe('getCardCycle (statement 15th, due 5th)', () => {
  it('mid-cycle after the statement date', () => {
    const c = getCardCycle(15, 5, new Date(2026, 10, 21)); // 21 Nov
    expect(c).toMatchObject({
      currentStart: '2026-11-16',
      currentEnd: '2026-12-15',
      lastStart: '2026-10-16',
      lastEnd: '2026-11-15',
      dueDate: '2026-12-05',
      daysToDue: 14,
      nextDueDate: '2027-01-05',
    });
  });

  it('on the statement day the cycle is still open', () => {
    const c = getCardCycle(15, 5, new Date(2026, 10, 15));
    expect(c.currentEnd).toBe('2026-11-15');
    expect(c.lastEnd).toBe('2026-10-15');
    expect(c.dueDate).toBe('2026-11-05');
    expect(c.daysToDue).toBe(-10);
  });

  it('due day after statement day falls in the same month', () => {
    const c = getCardCycle(1, 20, new Date(2026, 10, 10));
    expect(c.lastEnd).toBe('2026-11-01');
    expect(c.dueDate).toBe('2026-11-20');
  });

  it('clamps day 31 to short months', () => {
    const c = getCardCycle(31, 20, new Date(2027, 1, 10)); // 10 Feb 2027
    expect(c.currentEnd).toBe('2027-02-28');
    expect(c.lastEnd).toBe('2027-01-31');
  });

  it('lists upcoming due dates', () => {
    const d = upcomingDueDates(15, 5, 2, new Date(2026, 10, 21)).map(toISODate);
    expect(d).toEqual(['2026-12-05', '2027-01-05']);
  });
});

describe('recurrence', () => {
  it('monthly next occurrence with clamping', () => {
    expect(nextOccurrence('2026-01-31', 'monthly', 31)).toBe('2026-02-28');
    expect(nextOccurrence('2026-11-04', 'monthly', 5)).toBe('2026-11-05');
    expect(nextOccurrence('2026-11-05', 'monthly', 5)).toBe('2026-12-05');
  });

  it('weekly next occurrence', () => {
    // 21 Nov 2026 is a Saturday (6)
    expect(nextOccurrence('2026-11-21', 'weekly', 1)).toBe('2026-11-23');
    expect(nextOccurrence('2026-11-21', 'weekly', 6)).toBe('2026-11-28');
  });

  it('first occurrence can be today', () => {
    expect(firstOccurrence('2026-11-05', 'monthly', 5)).toBe('2026-11-05');
    expect(firstOccurrence('2026-11-06', 'monthly', 5)).toBe('2026-12-05');
  });

  it('collects missed occurrences', () => {
    expect(dueOccurrences('2026-09-05', '2026-11-21', 'monthly', 5)).toEqual({
      dates: ['2026-09-05', '2026-10-05', '2026-11-05'],
      nextRun: '2026-12-05',
    });
    expect(dueOccurrences('2026-12-05', '2026-11-21', 'monthly', 5).dates).toEqual([]);
  });
});

describe('validateTransaction', () => {
  const base = { amount: 5000, accountId: 'a', date: '2026-11-21' };
  it('accepts a valid expense', () => {
    expect(validateTransaction({ ...base, type: 'expense', categoryId: 'c' })).toEqual({});
  });
  it('reports missing fields', () => {
    const e = validateTransaction({ type: 'expense', amount: 0, accountId: null, date: 'x' });
    expect(Object.keys(e).sort()).toEqual(['accountId', 'amount', 'categoryId', 'date']);
  });
  it('rejects transfers to the same account', () => {
    expect(
      validateTransaction({ ...base, type: 'transfer', toAccountId: 'a' }).toAccountId,
    ).toBeDefined();
  });
  it('needs a fund for investments', () => {
    expect(validateTransaction({ ...base, type: 'investment' }).fundId).toBeDefined();
    expect(validateTransaction({ ...base, type: 'investment', fundId: 'f' })).toEqual({});
  });
});

describe('projectGoal', () => {
  const today = new Date(2026, 10, 21);
  it('computes progress, required pace and projection', () => {
    const p = projectGoal(10000000, 2500000, '2027-11-21', 1000000, today);
    expect(p.percent).toBe(25);
    expect(p.remaining).toBe(7500000);
    expect(p.requiredPerMonth).toBe(625000);
    expect(toISODate(p.projectedDate!)).toBe('2027-07-01');
    expect(p.onTrack).toBe(true);
  });
  it('handles completed goals and zero pace', () => {
    expect(projectGoal(100, 150, null, 0, today)).toMatchObject({ percent: 100, onTrack: true });
    expect(projectGoal(100, 0, '2027-01-01', 0, today).onTrack).toBe(false);
  });
});

describe('misc', () => {
  it('escapes CSV', () => {
    expect(
      toCSV(
        ['a', 'b'],
        [
          ['x,y', 'he said "hi"'],
          [1, null],
        ],
      ),
    ).toBe('a,b\r\n"x,y","he said ""hi"""\r\n1,\r\n');
  });
  it('formats helpers', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(22)).toBe('22nd');
    expect(ordinal(13)).toBe('13th');
    expect(toISODate(clampedDate(2026, 13, 31))).toBe('2027-02-28');
    const today = new Date(2026, 10, 21);
    expect(formatDayHeader('2026-11-21', today)).toBe('Today');
    expect(formatDayHeader('2026-11-20', today)).toBe('Yesterday');
    expect(formatDayHeader('2026-11-02', today)).toBe('Mon, 2 Nov');
  });
});
