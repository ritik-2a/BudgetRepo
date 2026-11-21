/** Date helpers. Transaction dates are stored as local calendar dates: "YYYY-MM-DD". */

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM" for the month containing `d`. */
export function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** First and last calendar date (inclusive) of the month containing `d`. */
export function monthRange(d: Date): { start: string; end: string } {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: toISODate(start), end: toISODate(end) };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Nov 2026" */
export function formatMonth(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
