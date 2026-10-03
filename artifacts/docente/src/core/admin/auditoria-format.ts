import { adminAuditoria } from "../../i18n/es-admin-auditoria";

// Display helpers of /admin/auditoria. Everything returned is plain text; the page renders it as
// text nodes, never as HTML.

const t = adminAuditoria;
const MAX_VALUE_LENGTH = 200;

const limaDateTime = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** dd/mm/aaaa hh:mm:ss in Lima time; "—" for a missing or invalid value. */
export function formatLimaDateTime(value: string | null | undefined): string {
  if (!value) return t.nullValue;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return t.nullValue;
  const p = Object.fromEntries(limaDateTime.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

/** Readable Spanish label of an action; an unknown action keeps its code. */
export function actionLabel(action: string): string {
  return Object.hasOwn(t.actions, action) ? t.actions[action] : action;
}

export function knownActions(): { code: string; label: string }[] {
  return Object.entries(t.actions).map(([code, label]) => ({ code, label }));
}

export function resultLabel(result: string): string {
  return Object.hasOwn(t.results, result) ? t.results[result as keyof typeof t.results] : result;
}

/** Email of the actor; "Cuenta eliminada" when the account is gone and "Sistema" for system events. */
export function actorLabel(row: { actor_user_id: string | null; actor_email: string | null; actor_context?: string | null }): string {
  if (row.actor_email) return row.actor_email;
  if (row.actor_user_id) return t.list.deletedAccount;
  return t.list.system;
}

export function resourceLabel(type: string | null, id: string | null): string {
  if (!type && !id) return t.list.noResource;
  const name = type ? (Object.hasOwn(t.resourceTypes, type) ? t.resourceTypes[type] : type) : "";
  return [name, id].filter(Boolean).join(" · ");
}

function clip(text: string): string {
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return t.nullValue;
  if (typeof value === "boolean") return value ? t.boolean.yes : t.boolean.no;
  if (typeof value === "string") return clip(value);
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (Array.isArray(value)) return clip(value.map(formatValue).join(", "));
  try {
    return clip(JSON.stringify(value));
  } catch {
    return t.nullValue;
  }
}

export type DetailPair = { key: string; label: string; value: string };

/** `details` (a JSON object of identifiers and codes) as readable key–value pairs. */
export function formatDetails(details: unknown): DetailPair[] {
  if (details === null || typeof details !== "object" || Array.isArray(details)) return [];
  return Object.entries(details as Record<string, unknown>).map(([key, value]) => ({
    key,
    label: Object.hasOwn(t.detailKeys, key) ? t.detailKeys[key] : key,
    value: formatValue(value),
  }));
}
