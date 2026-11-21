/**
 * Money helpers. All amounts are stored as integer paise (₹1 = 100 paise) to
 * avoid floating-point rounding errors.
 */

export type Paise = number;

/**
 * Parses user input like "1,250.5" or "₹ 99" into paise.
 * Returns null for empty or invalid input, or more than 2 decimal places.
 */
export function parseRupees(input: string): Paise | null {
  const cleaned = input.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(paise) ? paise : null;
}

/** Groups digits the Indian way: 1234567 -> "12,34,567". */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

export type FormatOptions = {
  /** Show paise ("₹1,250.50"). Default: only when non-zero. */
  decimals?: 'auto' | 'always' | 'never';
  /** Prefix positive values with "+". */
  signed?: boolean;
  /** Omit the ₹ symbol. */
  bare?: boolean;
};

/** Formats paise as Indian rupees, e.g. 12500050 -> "₹1,25,000.50". */
export function formatINR(paise: Paise, opts: FormatOptions = {}): string {
  const { decimals = 'auto', signed = false, bare = false } = opts;
  const negative = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const fraction = abs % 100;

  let out = groupIndian(String(rupees));
  if (decimals === 'always' || (decimals === 'auto' && fraction !== 0)) {
    out += '.' + String(fraction).padStart(2, '0');
  }
  if (!bare) out = '₹' + out;
  if (negative) out = '−' + out;
  else if (signed && abs > 0) out = '+' + out;
  return out;
}

/** Compact form for charts and tiles: ₹950, ₹12.5K, ₹3.4L, ₹1.2Cr. */
export function formatINRCompact(paise: Paise): string {
  const negative = paise < 0;
  const rupees = Math.abs(paise) / 100;
  const fmt = (n: number, unit: string) =>
    `${Number.isInteger(n) ? n : n.toFixed(1).replace(/\.0$/, '')}${unit}`;
  let out: string;
  if (rupees >= 1_00_00_000) out = fmt(rupees / 1_00_00_000, 'Cr');
  else if (rupees >= 1_00_000) out = fmt(rupees / 1_00_000, 'L');
  else if (rupees >= 1_000) out = fmt(rupees / 1_000, 'K');
  else out = String(Math.round(rupees));
  return (negative ? '−₹' : '₹') + out;
}
