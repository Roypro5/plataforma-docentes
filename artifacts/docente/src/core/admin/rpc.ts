import "server-only";
import { requireAdmin } from "@/core/auth/viewer";
import type { Permission } from "@/core/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminErrorKey, type AdminErrorKey } from "./errors";

export { ADMIN_PAGE_SIZE, parsePage, totalPages } from "./paging";

export type AdminResult<T> = { ok: true; data: T } | { ok: false; error: AdminErrorKey };

/**
 * Calls an administrative RPC after the app-side check (permission + aal2; requireAdmin redirects
 * to /admin/mfa without aal2). The database function enforces the same rule on its own, so this
 * check only picks the right screen; it is never the protection.
 */
export async function adminCall<T>(permission: Permission, fn: string, args?: Record<string, unknown>): Promise<AdminResult<T>> {
  const { allowed } = await requireAdmin(permission);
  if (!allowed) return { ok: false, error: "denied" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "generic" };
  const { data, error } = await supabase.rpc(fn, args ?? {});
  if (error) return { ok: false, error: adminErrorKey(error.code) };
  return { ok: true, data: data as T };
}
