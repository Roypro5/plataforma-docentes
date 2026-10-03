import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDenied } from "@/components/admin/denied";
import { Pager } from "@/components/admin/pager";
import { CreateOrgForm } from "@/components/admin/organizaciones/create-org-form";
import { OrgList } from "@/components/admin/organizaciones/org-list";
import { Notice } from "@/components/cuenta/notice";
import { btnQuiet, fieldClass } from "@/components/cuenta/styles";
import { Section } from "@/components/foundation/page-header";
import { listActiveCountries } from "@/core/admin/avisos-queries";
import { listOrgs } from "@/core/admin/organizaciones-queries";
import { isOrgStatus } from "@/core/admin/organizaciones-schemas";
import { parsePage } from "@/core/admin/rpc";
import { requireAdmin } from "@/core/auth/viewer";
import { admin } from "@/i18n/es-admin";
import { adminOrgs } from "@/i18n/es-admin-organizaciones";

export const metadata = { title: "Organizaciones de prueba · Administración" };

const t = adminOrgs;

export default async function OrganizacionesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { viewer, allowed } = await requireAdmin("admin.orgs.manage");
  if (!allowed) {
    return (
      <AdminShell viewer={viewer} section="organizaciones" title={t.title} lead={admin.denied}>
        <AdminDenied />
      </AdminShell>
    );
  }

  const query = await searchParams;
  const rawStatus = Array.isArray(query.status) ? query.status[0] : query.status;
  const status = isOrgStatus(rawStatus) ? rawStatus : null;
  const page = parsePage(query.page);

  const [list, countries] = await Promise.all([listOrgs(status, page), listActiveCountries()]);
  const countryNames = Object.fromEntries(countries.map((c) => [c.code, c.name]));

  return (
    <AdminShell viewer={viewer} section="organizaciones" title={t.title} lead={t.lead}>
      <Notice testId="notice-orgs-scope">{t.note}</Notice>

      <Section title={t.create.title}>
        <CreateOrgForm countries={countries} />
      </Section>

      <form method="get" className="flex flex-wrap items-end gap-2" data-testid="form-org-filter">
        <div>
          <label htmlFor="filter-org-status" className="text-sm font-medium">
            {t.list.filterLabel}
          </label>
          <select id="filter-org-status" name="status" defaultValue={status ?? ""} className={`${fieldClass} sm:w-56`} data-testid="select-org-status">
            <option value="">{t.list.filterAll}</option>
            <option value="active">{t.status.active}</option>
            <option value="inactive">{t.status.inactive}</option>
          </select>
        </div>
        <button type="submit" className={btnQuiet} data-testid="button-org-filter">
          {t.list.filterApply}
        </button>
        {status && (
          <Link href="/admin/organizaciones" className={btnQuiet} data-testid="link-org-filter-clear">
            {t.list.filterClear}
          </Link>
        )}
      </form>

      {list.failed ? (
        <Notice testId="notice-orgs-error">{admin.common.loadError}</Notice>
      ) : list.rows.length === 0 ? (
        <p className="paper rounded-2xl border p-5 text-sm text-muted-foreground" data-testid="text-orgs-empty">
          {status ? t.list.emptyFiltered : t.list.empty}
        </p>
      ) : (
        <OrgList rows={list.rows} countryNames={countryNames} />
      )}

      {!list.failed && (list.total > 0 || page > 1) && <Pager basePath="/admin/organizaciones" params={{ status: status ?? undefined }} page={page} total={list.total} />}
    </AdminShell>
  );
}
