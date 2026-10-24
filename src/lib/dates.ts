/** All business dates are handled in the company timezone (default Asia/Karachi). */
export const TZ = "Asia/Karachi";

/** Parse a YYYY-MM-DD string at UTC noon so date arithmetic never drifts across zones. */
export function d(s: string): Date {
  return new Date(s + "T12:00:00Z");
}

export function iso(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

export function addDays(s: string, n: number): string {
  const dt = d(s);
  dt.setUTCDate(dt.getUTCDate() + n);
  return iso(dt);
}

/** Today's date (YYYY-MM-DD) in the company timezone. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Current wall-clock HH:MM in the company timezone. */
export function nowTimeInTZ(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  if (!start || !end || start > end) return out;
  for (let s = start; s <= end; s = addDays(s, 1)) out.push(s);
  return out;
}

export function isWorkingDay(day: string, weekendDays: number[], holidays: Set<string>): boolean {
  const dow = d(day).getUTCDay();
  return !weekendDays.includes(dow) && !holidays.has(day);
}

/** Count working days in [start, end], skipping configured weekends and holidays. */
export function workingDaysBetween(
  start: string,
  end: string,
  weekendDays: number[],
  holidays: Iterable<string>
): number {
  const hs = holidays instanceof Set ? holidays : new Set(holidays);
  return eachDay(start, end).filter((x) => isWorkingDay(x, weekendDays, hs)).length;
}

export function monthStart(m: string): string {
  return m.slice(0, 7) + "-01";
}

export function monthEnd(m: string): string {
  const dt = d(monthStart(m));
  dt.setUTCMonth(dt.getUTCMonth() + 1);
  dt.setUTCDate(0);
  return iso(dt);
}

export function fmtDate(s?: string | null): string {
  if (!s) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d(s.slice(0, 10)));
}

export function fmtTime(ts?: string | null): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(new Date(ts));
}

export function fmtMonth(m: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d(monthStart(m)));
}

export function fmtMoney(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return "PKR " + n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
