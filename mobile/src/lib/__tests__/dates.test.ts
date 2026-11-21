import { formatMonth, monthRange, toISODate, toMonthKey } from '../dates';

describe('dates', () => {
  it('formats local dates', () => {
    const d = new Date(2026, 10, 5); // 5 Nov 2026
    expect(toISODate(d)).toBe('2026-11-05');
    expect(toMonthKey(d)).toBe('2026-11');
    expect(formatMonth(d)).toBe('Nov 2026');
  });

  it('computes month ranges including leap years', () => {
    expect(monthRange(new Date(2026, 10, 21))).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(monthRange(new Date(2028, 1, 10))).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(monthRange(new Date(2026, 11, 31))).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });
});
