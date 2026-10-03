import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminCall } from "./rpc";
import type { AnnouncementStatus } from "./avisos-schemas";

const PERMISSION = "admin.announcements.manage" as const;

export type AnnouncementRow = {
  id: string;
  title: string;
  status: AnnouncementStatus;
  starts_at: string;
  ends_at: string | null;
  country_codes: string[];
  role_codes: string[];
  plan_codes: string[];
  created_at: string;
};

export type AnnouncementListRow = AnnouncementRow & { total_count: number | string };
export type AnnouncementDetail = AnnouncementRow & { body: string };

export type Country = { code: string; name: string };

export async function listAnnouncements(
  status: AnnouncementStatus | null,
  page: number,
): Promise<{ rows: AnnouncementRow[]; total: number; failed: boolean }> {
  const result = await adminCall<AnnouncementListRow[]>(PERMISSION, "admin_list_announcements", { p_status: status, p_page: page });
  if (!result.ok) return { rows: [], total: 0, failed: true };
  const rows = result.data ?? [];
  return { rows, total: rows.length > 0 ? Number(rows[0].total_count) : 0, failed: false };
}

export async function getAnnouncement(id: string): Promise<{ item: AnnouncementDetail | null; notFound: boolean; failed: boolean }> {
  const result = await adminCall<AnnouncementDetail[]>(PERMISSION, "admin_get_announcement", { p_id: id });
  if (!result.ok) return { item: null, notFound: result.error === "notFound", failed: result.error !== "notFound" };
  const item = result.data?.[0] ?? null;
  return { item, notFound: item === null, failed: false };
}

/** Active countries, read with the normal client (public reference data). */
export async function listActiveCountries(): Promise<Country[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("countries").select("code, name").eq("active", true).order("name");
  return (data ?? []) as Country[];
}
