import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDenied } from "@/components/admin/denied";
import { ModuleList } from "@/components/admin/modulos/module-list";
import { Notice } from "@/components/cuenta/notice";
import { adminErrorMessage } from "@/core/admin/errors";
import { listActiveCountries, listModules } from "@/core/admin/modulos-queries";
import { requireAdmin } from "@/core/auth/viewer";
import { admin } from "@/i18n/es-admin";
import { adminModulos } from "@/i18n/es-admin-modulos";

export const metadata = { title: adminModulos.metaTitle };

const t = adminModulos;

export default async function AdminModulos() {
  const { viewer, allowed } = await requireAdmin("admin.modules.manage");
  if (!allowed) {
    return (
      <AdminShell viewer={viewer} section="modulos" title={t.title} lead={t.lead}>
        <AdminDenied />
      </AdminShell>
    );
  }

  const [modules, countries] = await Promise.all([listModules(), listActiveCountries()]);

  return (
    <AdminShell viewer={viewer} section="modulos" title={t.title} lead={t.lead}>
      <p className="text-sm text-muted-foreground">{t.note}</p>
      {!modules.ok ? (
        <Notice testId="notice-modules-error">{adminErrorMessage(modules.error)}</Notice>
      ) : (
        <>
          {countries === null && <Notice testId="notice-countries-error">{admin.common.loadError}</Notice>}
          <ModuleList rows={modules.data} countries={countries ?? []} />
        </>
      )}
    </AdminShell>
  );
}
