import { formatINR, formatINRCompact, parseRupees } from '../money';

describe('parseRupees', () => {
  it.each([
    ['100', 10000],
    ['1,250.5', 125050],
    ['₹ 99.99', 9999],
    ['0.05', 5],
    ['12,34,567', 123456700],
  ])('parses %s', (input, expected) => {
    expect(parseRupees(input)).toBe(expected);
  });

  it.each(['', 'abc', '1.234', '-5', '1.2.3'])('rejects %p', (input) => {
    expect(parseRupees(input)).toBeNull();
  });
});

describe('formatINR', () => {
  it('uses Indian digit grouping', () => {
    expect(formatINR(0)).toBe('₹0');
    expect(formatINR(99900)).toBe('₹999');
    expect(formatINR(100000)).toBe('₹1,000');
    expect(formatINR(12500000)).toBe('₹1,25,000');
    expect(formatINR(1234567800)).toBe('₹1,23,45,678');
  });

  it('handles paise and sign options', () => {
    expect(formatINR(125050)).toBe('₹1,250.50');
    expect(formatINR(125000, { decimals: 'always' })).toBe('₹1,250.00');
    expect(formatINR(125050, { decimals: 'never' })).toBe('₹1,250');
    expect(formatINR(-5000)).toBe('−₹50');
    expect(formatINR(5000, { signed: true })).toBe('+₹50');
    expect(formatINR(5000, { bare: true })).toBe('50');
  });
});

describe('formatINRCompact', () => {
  it('abbreviates with K / L / Cr', () => {
    expect(formatINRCompact(95000)).toBe('₹950');
    expect(formatINRCompact(1250000)).toBe('₹12.5K');
    expect(formatINRCompact(34000000)).toBe('₹3.4L');
    expect(formatINRCompact(1200000000)).toBe('₹1.2Cr');
    expect(formatINRCompact(-200000)).toBe('−₹2K');
  });
});
