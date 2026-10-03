import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAppEnv } from "./access";
import type { NotificationRow } from "./notification-text";
import { resolveModuleViews, type ModuleRow, type ModuleView } from "./views";

export const NOTIFICATIONS_PAGE_SIZE = 20;

export type Announcement = { id: string; title: string; body: string; starts_at: string };

/**
 * Modules visible to the signed-in user: the SQL resolver (list_my_modules) joined with the code
 * manifests plus the environment rule. `failed` is true when the RPC errored (fail closed: no modules).
 */
export async function listMyModules(supabase: SupabaseClient): Promise<{ modules: ModuleView[]; failed: boolean }> {
  const { data, error } = await supabase.rpc("list_my_modules");
  if (error) return { modules: [], failed: true };
  const rows = (data ?? []) as ModuleRow[];
  return { modules: resolveModuleViews(rows, resolveAppEnv(process.env.NEXT_PUBLIC_APP_ENV)), failed: false };
}

// RLS already keeps only published, in-range announcements for the viewer's country, roles and plan.
export async function listVisibleAnnouncements(supabase: SupabaseClient, limit = 5): Promise<{ items: Announcement[]; failed: boolean }> {
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, starts_at")
    .order("starts_at", { ascending: false })
    .limit(limit);
  if (error) return { items: [], failed: true };
  return { items: (data ?? []) as Announcement[], failed: false };
}

// Page numbers start at 1. One extra row is requested to know whether a next page exists.
export async function listNotifications(
  supabase: SupabaseClient,
  page = 1,
  pageSize = NOTIFICATIONS_PAGE_SIZE,
): Promise<{ items: NotificationRow[]; hasNext: boolean; failed: boolean }> {
  const from = (Math.max(1, page) - 1) * pageSize;
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link_path, read_at, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize);
  if (error) return { items: [], hasNext: false, failed: true };
  const rows = (data ?? []) as NotificationRow[];
  return { items: rows.slice(0, pageSize), hasNext: rows.length > pageSize, failed: false };
}

export async function countUnread(supabase: SupabaseClient): Promise<number | null> {
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return error ? null : (count ?? 0);
}
