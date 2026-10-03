import { z } from "zod";
import { parsePage } from "./paging";

// Pure helpers of /admin/auditoria: query-string parsing and the arguments of `admin_list_audit`.

export type AuditFilters = {
  action?: string;
  actor?: string;
  resourceType?: string;
  resourceId?: string;
  /** YYYY-MM-DD, Lima time, inclusive. */
  from?: string;
  /** YYYY-MM-DD, Lima time, inclusive. */
  to?: string;
  page: number;
};

export type AuditParam = "action" | "actor" | "resource_type" | "resource_id" | "from" | "to";
type RawParams = Record<string, string | string[] | undefined>;

const actionSchema = z.string().regex(/^[a-z_.]{1,100}$/);
const actorSchema = z.string().uuid();
const resourceTypeSchema = z.string().regex(/^[a-z_]{1,60}$/);
const resourceIdSchema = z.string().min(1).max(200);

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

/** A real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Reads `?action=&actor=&resource_type=&resource_id=&from=&to=&page=`. A filter with an invalid
 * value is dropped (never sent to the database) and reported in `ignored` so the page can say so.
 */
export function parseAuditFilters(raw: RawParams): { filters: AuditFilters; ignored: AuditParam[] } {
  const ignored: AuditParam[] = [];
  const pick = (key: AuditParam, valid: (v: string) => boolean): string | undefined => {
    const v = first(raw[key]);
    if (v === undefined) return undefined;
    if (valid(v)) return v;
    ignored.push(key);
    return undefined;
  };
  const filters: AuditFilters = {
    action: pick("action", (v) => actionSchema.safeParse(v).success),
    actor: pick("actor", (v) => actorSchema.safeParse(v).success),
    resourceType: pick("resource_type", (v) => resourceTypeSchema.safeParse(v).success),
    resourceId: pick("resource_id", (v) => resourceIdSchema.safeParse(v).success),
    from: pick("from", isIsoDate),
    to: pick("to", isIsoDate),
    page: parsePage(raw.page),
  };
  return { filters, ignored };
}

/** `Desde` after `Hasta` would make the database answer 22023, so the page does not even ask. */
export function isRangeValid(f: Pick<AuditFilters, "from" | "to">): boolean {
  return !(f.from && f.to && f.from > f.to);
}

// Lima has no daylight saving time: it is always UTC-5.
const LIMA_OFFSET = "-05:00";

function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Arguments of `admin_list_audit`: `p_from` ≤ occurred_at < `p_to`, with `to` included as a whole day. */
export function auditListArgs(f: AuditFilters) {
  return {
    p_action: f.action ?? null,
    p_actor: f.actor ?? null,
    p_resource_type: f.resourceType ?? null,
    p_resource_id: f.resourceId ?? null,
    p_from: f.from ? `${f.from}T00:00:00${LIMA_OFFSET}` : null,
    p_to: f.to ? `${nextDay(f.to)}T00:00:00${LIMA_OFFSET}` : null,
    p_page: f.page,
  };
}

export type AuditRow = {
  id: number | string;
  occurred_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_context: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  result: string;
  details: unknown;
  total_count: number | string;
};
