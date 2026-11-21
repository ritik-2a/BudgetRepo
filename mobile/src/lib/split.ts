/**
 * Bill splitting maths (amounts in paise).
 *
 * The payer's account pays the full bill. "My share" is my expense; every other
 * participant's share becomes money they owe me.
 */

export type SplitMode = 'equal' | 'custom';

export type SplitInput = {
  total: number;
  /** Am I one of the people sharing the bill? */
  includeMe: boolean;
  personIds: string[];
  mode: SplitMode;
  /** Custom amounts per person (paise); only used in custom mode. */
  custom?: Record<string, number>;
};

export type SplitResult =
  | { ok: true; mine: number; shares: { personId: string; amount: number }[] }
  | { ok: false; error: string };

export function computeSplit(i: SplitInput): SplitResult {
  if (!(i.total > 0)) return { ok: false, error: 'Enter the bill amount first' };
  if (i.personIds.length === 0) return { ok: false, error: 'Pick who you split with' };

  if (i.mode === 'equal') {
    const n = i.personIds.length + (i.includeMe ? 1 : 0);
    const base = Math.floor(i.total / n);
    let remainder = i.total - base * n;
    // Odd paise go to me if I'm included, otherwise to the first people.
    let mine = i.includeMe ? base + remainder : 0;
    if (i.includeMe) remainder = 0;
    const shares = i.personIds.map((personId) => {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      return { personId, amount: base + extra };
    });
    if (!i.includeMe) mine = 0;
    return { ok: true, mine, shares };
  }

  const shares = i.personIds.map((personId) => ({
    personId,
    amount: Math.max(0, Math.round(i.custom?.[personId] ?? 0)),
  }));
  const others = shares.reduce((s, x) => s + x.amount, 0);
  if (shares.some((s) => s.amount === 0)) {
    return { ok: false, error: 'Enter an amount for each person' };
  }
  if (others > i.total) return { ok: false, error: "Friends' shares are more than the bill" };
  const mine = i.total - others;
  if (!i.includeMe && mine !== 0) {
    return { ok: false, error: 'Shares must add up to the bill when you are not included' };
  }
  return { ok: true, mine, shares };
}
