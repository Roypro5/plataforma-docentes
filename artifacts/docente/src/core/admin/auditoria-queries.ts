import "server-only";
import { adminCall, type AdminResult } from "./rpc";
import { auditListArgs, type AuditFilters, type AuditRow } from "./auditoria-schemas";

export type AuditList = { rows: AuditRow[]; total: number };

/** One page of `admin_list_audit` (permiso `admin.audit.read`). Reading the audit is not audited. */
export async function listAudit(filters: AuditFilters): Promise<AdminResult<AuditList>> {
  const res = await adminCall<AuditRow[] | null>("admin.audit.read", "admin_list_audit", auditListArgs(filters));
  if (!res.ok) return res;
  const rows = res.data ?? [];
  return { ok: true, data: { rows, total: rows.length > 0 ? Number(rows[0].total_count) : 0 } };
}
