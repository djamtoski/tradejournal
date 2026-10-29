/** Calendar helpers. Day keys are local-time "YYYY-MM-DD"; months are "YYYY-MM". */

import { dayKey } from "./stats";

export { dayKey };

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function parseMonth(s: string | undefined, fallback: Date): Date {
  const m = s?.match(/^(\d{4})-(\d{2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return new Date(+m[1], +m[2] - 1, 1);
  return new Date(fallback.getFullYear(), fallback.getMonth(), 1);
}

export function parseDay(s: string | undefined): Date | null {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}

export function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Weeks (Mon–Sun) covering the month; days outside it are null. */
export function monthWeeks(month: Date): (Date | null)[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const monthLabel = (d: Date, opts: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" }) =>
  d.toLocaleDateString("en-US", opts);
