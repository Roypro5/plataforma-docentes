// Announcement dates are typed in Lima time (America/Lima, UTC-5, no daylight saving) and sent to
// the database as ISO 8601 with an explicit offset. Pure functions, no Intl dependency, so the
// result is the same on the server, in the browser and in tests.
const LIMA_OFFSET_HOURS = 5;
const HOUR_MS = 3_600_000;
const INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/;

const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

const pad = (n: number, size = 2) => String(n).padStart(size, "0");

/**
 * "2026-10-05T08:30" (value of a datetime-local input, Lima time) → "2026-10-05T08:30:00-05:00".
 * Returns null for anything that is not a real date and time.
 */
export function limaInputToIso(input: string): string | null {
  const m = INPUT.exec(input.trim());
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1, 6).map(Number);
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const real =
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day &&
    check.getUTCHours() === hour &&
    check.getUTCMinutes() === minute;
  if (!real) return null;
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00-0${LIMA_OFFSET_HOURS}:00`;
}

/** An instant (ISO string from the database) → "YYYY-MM-DDTHH:mm" in Lima time, or "" if it is not a date. */
export function isoToLimaInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t - LIMA_OFFSET_HOURS * HOUR_MS);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** An instant → "5 oct 2026, 08:30" in Lima time, or "" if it is not a date. */
export function formatLima(iso: string | null | undefined): string {
  const local = isoToLimaInput(iso);
  if (!local) return "";
  const [y, mo, d, h, mi] = [local.slice(0, 4), local.slice(5, 7), local.slice(8, 10), local.slice(11, 13), local.slice(14, 16)];
  return `${Number(d)} ${months[Number(mo) - 1]} ${y}, ${h}:${mi}`;
}

/** "2026-10-05" (a date without time) → "5 oct". */
export function formatDayShort(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  return `${Number(m[3])} ${months[Number(m[2]) - 1] ?? m[2]}`;
}
