import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDenied } from "@/components/admin/denied";
import { Pager } from "@/components/admin/pager";
import { UserFiltersForm } from "@/components/admin/usuarios/user-filters";
import { UserList } from "@/components/admin/usuarios/user-list";
import { Notice } from "@/components/cuenta/notice";
import { adminErrorMessage } from "@/core/admin/errors";
import { listUsers } from "@/core/admin/usuarios-queries";
import { parseUserFilters } from "@/core/admin/usuarios-schemas";
import { requireAdmin, viewerCan } from "@/core/auth/viewer";
import { adminUsuarios } from "@/i18n/es-admin-usuarios";

export const metadata = { title: adminUsuarios.metaTitle };

const t = adminUsuarios;

export default async function AdminUsuarios({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { viewer, allowed } = await requireAdmin("admin.users.read");
  if (!allowed) {
    return (
      <AdminShell viewer={viewer} section="usuarios" title={t.title} lead={t.lead}>
        <AdminDenied />
      </AdminShell>
    );
  }

  const filters = parseUserFilters(await searchParams);
  const result = await listUsers(filters);

  return (
    <AdminShell viewer={viewer} section="usuarios" title={t.title} lead={t.lead}>
      <UserFiltersForm filters={filters} />
      {result.ok ? (
        <>
          <UserList
            rows={result.data.rows}
            ctx={{
              viewerId: viewer.userId,
              canSuspend: viewerCan(viewer, "admin.users.suspend"),
              canGrant: viewerCan(viewer, "admin.roles.grant"),
              canGrantPrivileged: viewerCan(viewer, "admin.roles.grant_privileged"),
            }}
            showAudit={viewerCan(viewer, "admin.audit.read")}
          />
          <Pager
            basePath="/admin/usuarios"
            params={{ q: filters.q, status: filters.status, role: filters.role }}
            page={filters.page}
            total={result.data.total}
          />
        </>
      ) : (
        <Notice testId="notice-users-error">{adminErrorMessage(result.error)}</Notice>
      )}
    </AdminShell>
  );
}
