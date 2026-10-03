import "server-only";
import { adminCall } from "./rpc";
import type { OrgStatus } from "./organizaciones-schemas";

const PERMISSION = "admin.orgs.manage" as const;

export type OrgRow = {
  id: string;
  name: string;
  country_code: string;
  status: string;
  is_test: boolean;
  member_count: number | string;
  created_at: string;
  total_count: number | string;
};

export type OrgMember = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role_code: string;
  status: string;
  created_at: string;
  removed_at: string | null;
};

export async function listOrgs(status: OrgStatus | null, page: number): Promise<{ rows: OrgRow[]; total: number; failed: boolean }> {
  const result = await adminCall<OrgRow[]>(PERMISSION, "admin_list_orgs", { p_status: status, p_page: page });
  if (!result.ok) return { rows: [], total: 0, failed: true };
  const rows = result.data ?? [];
  return { rows, total: rows.length > 0 ? Number(rows[0].total_count) : 0, failed: false };
}

/** One organization by id (admin_get_org returns a single row); null if missing or on error. */
export async function findOrg(id: string): Promise<OrgRow | null> {
  const result = await adminCall<Omit<OrgRow, "total_count">[]>(PERMISSION, "admin_get_org", { p_org: id });
  if (!result.ok) return null;
  const row = result.data?.[0];
  return row ? { ...row, total_count: 1 } : null;
}

export async function listOrgMembers(id: string): Promise<{ members: OrgMember[]; notFound: boolean; failed: boolean }> {
  const result = await adminCall<OrgMember[]>(PERMISSION, "admin_list_org_members", { p_org: id });
  if (!result.ok) return { members: [], notFound: result.error === "notFound", failed: result.error !== "notFound" };
  return { members: result.data ?? [], notFound: false, failed: false };
}
