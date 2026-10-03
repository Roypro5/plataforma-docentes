import { z } from "zod";
import { roleCodes } from "../auth/permissions";
import { parsePage } from "./paging";

// Pure helpers of /admin/usuarios: query-string parsing, action schemas and the per-row rules for
// which actions to offer. The database repeats every rule; these only decide what to show.

export const USER_STATUSES = ["active", "suspended", "deletion_pending"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Platform roles an admin can manage. `creador` and `revisor` are blocked and `director` is institutional. */
export const ASSIGNABLE_ROLES = ["docente", "admin", "superadmin"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
export const PRIVILEGED_ROLES: readonly AssignableRole[] = ["admin", "superadmin"];

export const MAX_QUERY_LENGTH = 100;

export function isPrivilegedRole(role: string): boolean {
  return (PRIVILEGED_ROLES as readonly string[]).includes(role);
}

/** `admin` and `superadmin` are offered only with `admin.roles.grant_privileged`. */
export function assignableRoles(canGrantPrivileged: boolean): AssignableRole[] {
  return ASSIGNABLE_ROLES.filter((r) => canGrantPrivileged || !isPrivilegedRole(r));
}

export type UserFilters = { q?: string; status?: UserStatus; role?: string; page: number };
type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Reads `?q=&status=&role=&page=`; anything invalid is dropped instead of reaching the database. */
export function parseUserFilters(raw: RawParams): UserFilters {
  const q = first(raw.q)?.trim().slice(0, MAX_QUERY_LENGTH);
  const status = first(raw.status);
  const role = first(raw.role);
  return {
    q: q ? q : undefined,
    status: (USER_STATUSES as readonly string[]).includes(status ?? "") ? (status as UserStatus) : undefined,
    role: (roleCodes as readonly string[]).includes(role ?? "") ? role : undefined,
    page: parsePage(raw.page),
  };
}

/** Arguments of `admin_list_users`. */
export function userListArgs(f: UserFilters) {
  return { p_query: f.q ?? null, p_status: f.status ?? null, p_role: f.role ?? null, p_page: f.page };
}

export const setStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["active", "suspended"]),
});

export const roleChangeSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(ASSIGNABLE_ROLES),
});

export type UserRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  country_code: string | null;
  status: UserStatus;
  roles: string[] | null;
  created_at: string;
  total_count: number | string;
};

export type ActionContext = {
  viewerId: string;
  canSuspend: boolean;
  canGrant: boolean;
  canGrantPrivileged: boolean;
};

export type RowActions = {
  own: boolean;
  suspend: boolean;
  reactivate: boolean;
  grantable: AssignableRole[];
  revocable: AssignableRole[];
};

/** Which actions a row offers to the viewer. Nothing is offered on the viewer's own account. */
export function rowActions(row: Pick<UserRow, "user_id" | "status" | "roles">, ctx: ActionContext): RowActions {
  const none: RowActions = { own: false, suspend: false, reactivate: false, grantable: [], revocable: [] };
  if (row.user_id === ctx.viewerId) return { ...none, own: true };
  const held = row.roles ?? [];
  const allowed = assignableRoles(ctx.canGrantPrivileged);
  // The database refuses to change the status of an admin unless the viewer is a superadmin.
  const touchesAdmin = held.some(isPrivilegedRole) && !ctx.canGrantPrivileged;
  const canChangeStatus = ctx.canSuspend && !touchesAdmin;
  return {
    own: false,
    suspend: canChangeStatus && row.status === "active",
    reactivate: canChangeStatus && row.status === "suspended",
    grantable: ctx.canGrant && row.status === "active" ? allowed.filter((r) => !held.includes(r)) : [],
    revocable: ctx.canGrant ? allowed.filter((r) => held.includes(r)) : [],
  };
}

export function auditLinkForUser(userId: string): string {
  return `/admin/auditoria?resource_type=user&resource_id=${encodeURIComponent(userId)}`;
}

const limaDate = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** dd/mm/aaaa in Lima time; "—" for a missing or invalid value. */
export function formatLimaDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = Object.fromEntries(limaDate.formatToParts(d).map((p) => [p.type, p.value]));
  return `${parts.day}/${parts.month}/${parts.year}`;
}
