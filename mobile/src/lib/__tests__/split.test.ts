import { computeSplit } from '../split';

describe('computeSplit', () => {
  it('splits equally with me, odd paise to me', () => {
    const r = computeSplit({
      total: 100000,
      includeMe: true,
      personIds: ['a', 'b'],
      mode: 'equal',
    });
    expect(r).toEqual({
      ok: true,
      mine: 33334,
      shares: [
        { personId: 'a', amount: 33333 },
        { personId: 'b', amount: 33333 },
      ],
    });
  });

  it('splits among 4 people (me + 3)', () => {
    const r = computeSplit({
      total: 120000,
      includeMe: true,
      personIds: ['a', 'b', 'c'],
      mode: 'equal',
    });
    expect(r.ok && r.mine).toBe(30000);
    expect(r.ok && r.shares.every((s) => s.amount === 30000)).toBe(true);
  });

  it('handles a purchase entirely for a friend', () => {
    const r = computeSplit({
      total: 20700,
      includeMe: false,
      personIds: ['suhani'],
      mode: 'equal',
    });
    expect(r).toEqual({ ok: true, mine: 0, shares: [{ personId: 'suhani', amount: 20700 }] });
  });

  it('spreads odd paise across friends when I am not included', () => {
    const r = computeSplit({ total: 1001, includeMe: false, personIds: ['a', 'b'], mode: 'equal' });
    expect(r.ok && r.shares.map((s) => s.amount)).toEqual([501, 500]);
  });

  it('custom amounts: my share is the rest', () => {
    const r = computeSplit({
      total: 90000,
      includeMe: true,
      personIds: ['a', 'b'],
      mode: 'custom',
      custom: { a: 20000, b: 30000 },
    });
    expect(r.ok && r.mine).toBe(40000);
  });

  it('rejects impossible custom splits', () => {
    expect(
      computeSplit({
        total: 1000,
        includeMe: true,
        personIds: ['a'],
        mode: 'custom',
        custom: { a: 2000 },
      }).ok,
    ).toBe(false);
    expect(
      computeSplit({
        total: 1000,
        includeMe: false,
        personIds: ['a'],
        mode: 'custom',
        custom: { a: 500 },
      }).ok,
    ).toBe(false);
    expect(computeSplit({ total: 1000, includeMe: true, personIds: [], mode: 'equal' }).ok).toBe(
      false,
    );
  });
});
