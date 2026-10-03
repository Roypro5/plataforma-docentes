import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDenied } from "@/components/admin/denied";
import { Pager } from "@/components/admin/pager";
import { AnnouncementList } from "@/components/admin/avisos/announcement-list";
import { Notice } from "@/components/cuenta/notice";
import { btnPrimary, btnQuiet, fieldClass } from "@/components/cuenta/styles";
import { listActiveCountries, listAnnouncements } from "@/core/admin/avisos-queries";
import { isAnnouncementStatus } from "@/core/admin/avisos-schemas";
import { parsePage } from "@/core/admin/rpc";
import { requireAdmin } from "@/core/auth/viewer";
import { admin } from "@/i18n/es-admin";
import { adminAvisos } from "@/i18n/es-admin-avisos";

export const metadata = { title: "Avisos · Administración" };

const t = adminAvisos;

export default async function AvisosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { viewer, allowed } = await requireAdmin("admin.announcements.manage");
  if (!allowed) {
    return (
      <AdminShell viewer={viewer} section="avisos" title={t.title} lead={admin.denied}>
        <AdminDenied />
      </AdminShell>
    );
  }

  const query = await searchParams;
  const rawStatus = Array.isArray(query.status) ? query.status[0] : query.status;
  const status = isAnnouncementStatus(rawStatus) ? rawStatus : null;
  const page = parsePage(query.page);

  const [list, countries] = await Promise.all([listAnnouncements(status, page), listActiveCountries()]);
  const countryNames = Object.fromEntries(countries.map((c) => [c.code, c.name]));

  return (
    <AdminShell viewer={viewer} section="avisos" title={t.title} lead={t.lead}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="flex flex-wrap items-end gap-2" data-testid="form-announcement-filter">
          <div>
            <label htmlFor="filter-status" className="text-sm font-medium">
              {t.list.filterLabel}
            </label>
            <select id="filter-status" name="status" defaultValue={status ?? ""} className={`${fieldClass} sm:w-56`} data-testid="select-announcement-status">
              <option value="">{t.list.filterAll}</option>
              <option value="draft">{t.status.draft}</option>
              <option value="published">{t.status.published}</option>
            </select>
          </div>
          <button type="submit" className={btnQuiet} data-testid="button-announcement-filter">
            {t.list.filterApply}
          </button>
          {status && (
            <Link href="/admin/avisos" className={btnQuiet} data-testid="link-announcement-filter-clear">
              {t.list.filterClear}
            </Link>
          )}
        </form>
        <Link href="/admin/avisos/nuevo" className={btnPrimary} data-testid="link-announcement-new">
          <Plus className="h-4 w-4" aria-hidden />
          {t.newButton}
        </Link>
      </div>

      {list.failed ? (
        <Notice testId="notice-announcements-error">{admin.common.loadError}</Notice>
      ) : list.rows.length === 0 ? (
        <p className="paper rounded-2xl border p-5 text-sm text-muted-foreground" data-testid="text-announcements-empty">
          {status ? t.list.emptyFiltered : t.list.empty}
        </p>
      ) : (
        <AnnouncementList rows={list.rows} countryNames={countryNames} />
      )}

      {!list.failed && (list.total > 0 || page > 1) && <Pager basePath="/admin/avisos" params={{ status: status ?? undefined }} page={page} total={list.total} />}
    </AdminShell>
  );
}
