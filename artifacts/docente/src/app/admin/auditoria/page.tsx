import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDenied } from "@/components/admin/denied";
import { Pager } from "@/components/admin/pager";
import { AuditFiltersForm } from "@/components/admin/auditoria/audit-filters";
import { AuditList } from "@/components/admin/auditoria/audit-list";
import { Notice } from "@/components/cuenta/notice";
import { listAudit } from "@/core/admin/auditoria-queries";
import { isRangeValid, parseAuditFilters } from "@/core/admin/auditoria-schemas";
import { adminErrorMessage } from "@/core/admin/errors";
import { requireAdmin } from "@/core/auth/viewer";
import { adminAuditoria } from "@/i18n/es-admin-auditoria";

export const metadata = { title: adminAuditoria.metaTitle };

const t = adminAuditoria;

export default async function AdminAuditoria({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { viewer, allowed } = await requireAdmin("admin.audit.read");
  if (!allowed) {
    return (
      <AdminShell viewer={viewer} section="auditoria" title={t.title} lead={t.lead}>
        <AdminDenied />
      </AdminShell>
    );
  }

  const { filters, ignored } = parseAuditFilters(await searchParams);
  const rangeOk = isRangeValid(filters);
  const result = rangeOk ? await listAudit(filters) : null;

  return (
    <AdminShell viewer={viewer} section="auditoria" title={t.title} lead={t.lead}>
      <AuditFiltersForm filters={filters} />
      {ignored.length > 0 && (
        <Notice testId="notice-audit-ignored">{t.filters.ignored(ignored.map((k) => t.filterNames[k]).join(", "))}</Notice>
      )}
      {!rangeOk && <Notice testId="notice-audit-range">{t.filters.rangeInvalid}</Notice>}
      {result &&
        (result.ok ? (
          <>
            <AuditList rows={result.data.rows} />
            <Pager
              basePath="/admin/auditoria"
              params={{
                action: filters.action,
                actor: filters.actor,
                resource_type: filters.resourceType,
                resource_id: filters.resourceId,
                from: filters.from,
                to: filters.to,
              }}
              page={filters.page}
              total={result.data.total}
            />
          </>
        ) : (
          <Notice testId="notice-audit-error">{adminErrorMessage(result.error)}</Notice>
        ))}
    </AdminShell>
  );
}
