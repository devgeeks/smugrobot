/** Local "YYYY-MM-DDTHH:mm" for a <vault-input type="datetime-local">, from an ISO timestamp. */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Local "YYYY-MM-DDTHH:mm" for a <vault-input type="datetime-local">, defaulting to now. */
export function nowForDatetimeLocal(): string {
  return toDatetimeLocalValue(new Date().toISOString());
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** "3h 20m" between two ISO timestamps, or null if either is missing/invalid. */
export function formatDuration(startIso: string, endIso: string | null): string | null {
  if (!endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const totalMin = Math.round((end - start) / 60_000);
  const hr = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (hr === 0) return `${min}m`;
  if (min === 0) return `${hr}h`;
  return `${hr}h ${min}m`;
}

/** Local calendar day key (YYYY-MM-DD) for an ISO timestamp — used to bucket episodes by day. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Builds a YYYY-MM-DD key from local date parts (year, 0-based month, day).
 * Use this for calendar-grid cells instead of `new Date("YYYY-MM-DD").toISOString()`
 * — a date-only ISO string parses as UTC midnight, which shifts a day in
 * negative-UTC-offset timezones.
 */
export function dayKeyFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parses a YYYY-MM-DD key (as produced by dayKey/dayKeyFromParts) into a local Date. */
export function parseDayKey(key: string): Date {
  const parts = key.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(y, m - 1, d);
}
