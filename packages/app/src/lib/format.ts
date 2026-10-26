const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });

const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

/** "5 min. ago", "in 6 days", "just now". */
export function timeAgo(timestamp: number, now = Date.now()): string {
  const diff = timestamp - now;
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const dateYearFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });
const fullFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

/** A full timestamp for tooltips and `title` attributes. */
export const fullDate = (timestamp: number) => fullFormat.format(timestamp);

/** "YYYY-MM-DD" (a due date, no time zone) → "Oct 28", or "Oct 28, 2027" outside this year. */
export function formatDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  const value = new Date(year, month - 1, date);
  return value.getFullYear() === new Date().getFullYear() ? dateFormat.format(value) : dateYearFormat.format(value);
}

/** Today as "YYYY-MM-DD" in local time. */
export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
