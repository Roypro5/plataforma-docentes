import "server-only";
import { adminCall, type AdminResult } from "./rpc";
import { userListArgs, type UserFilters, type UserRow } from "./usuarios-schemas";

export type UserList = { rows: UserRow[]; total: number };

/** One page of `admin_list_users` (permiso `admin.users.read`). The database audits the search. */
export async function listUsers(filters: UserFilters): Promise<AdminResult<UserList>> {
  const res = await adminCall<UserRow[] | null>("admin.users.read", "admin_list_users", userListArgs(filters));
  if (!res.ok) return res;
  const rows = res.data ?? [];
  return { ok: true, data: { rows, total: rows.length > 0 ? Number(rows[0].total_count) : 0 } };
}
