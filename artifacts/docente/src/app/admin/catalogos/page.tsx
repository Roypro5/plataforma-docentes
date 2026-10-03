import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDenied } from "@/components/admin/denied";
import { Pager } from "@/components/admin/pager";
import { CatalogList } from "@/components/admin/catalogos/catalog-list";
import { Notice } from "@/components/cuenta/notice";
import { btnPrimary, btnQuiet, fieldClass } from "@/components/cuenta/styles";
import { listAllCatalog, listCatalog } from "@/core/admin/catalogos-queries";
import { catalogKinds, catalogParentKind, parseCatalogFilters, CATALOG_QUERY_MAX } from "@/core/admin/catalogos-schemas";
import { requireAdmin } from "@/core/auth/viewer";
import { admin } from "@/i18n/es-admin";
import { adminCatalogos } from "@/i18n/es-admin-catalogos";

export const metadata = { title: "Catálogos · Administración" };

const t = adminCatalogos;

export default async function CatalogosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { viewer, allowed } = await requireAdmin("admin.catalogs.manage");
  if (!allowed) {
    return (
      <AdminShell viewer={viewer} section="catalogos" title={t.title} lead={admin.denied}>
        <AdminDenied />
      </AdminShell>
    );
  }

  const { kind, q, parent, page } = parseCatalogFilters(await searchParams);
  const parentKind = catalogParentKind(kind);
  const [list, parents] = await Promise.all([listCatalog(kind, parent, q, page), parentKind ? listAllCatalog(parentKind) : Promise.resolve([])]);
  const filtered = q !== "" || parent !== null;

  return (
    <AdminShell viewer={viewer} section="catalogos" title={t.title} lead={t.lead}>
      <Notice testId="notice-catalog-scope">
        <p>{t.note}</p>
        <p className="mt-1">{t.deactivateNote}</p>
      </Notice>

      <nav aria-label={t.tabsLabel}>
        <ul className="flex flex-wrap gap-2">
          {catalogKinds.map((k) => {
            const active = k === kind;
            return (
              <li key={k}>
                <Link
                  href={`/admin/catalogos?kind=${k}`}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-xl px-3.5 text-sm font-medium ${active ? "bg-primary text-primary-foreground" : "border hover:bg-muted"}`}
                  data-testid={`link-catalog-${k}`}
                >
                  {t.kinds[k].tab}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form method="get" className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end" data-testid="form-catalog-filter">
        <input type="hidden" name="kind" value={kind} />
        <div>
          <label htmlFor="catalog-q" className="text-sm font-medium">
            {t.filter.searchLabel}
          </label>
          <input
            id="catalog-q"
            name="q"
            type="search"
            maxLength={CATALOG_QUERY_MAX}
            defaultValue={q}
            placeholder={t.filter.searchPlaceholder}
            className={fieldClass}
            data-testid="input-catalog-search"
          />
        </div>
        {parentKind && (
          <div>
            <label htmlFor="catalog-parent" className="text-sm font-medium">
              {t.filter.parentLabel[kind as "ugel" | "grade"]}
            </label>
            <select id="catalog-parent" name="parent" defaultValue={parent ?? ""} className={`${fieldClass} sm:w-60`} data-testid="select-catalog-parent">
              <option value="">{t.filter.parentAll[kind as "ugel" | "grade"]}</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={btnPrimary} data-testid="button-catalog-filter">
            {t.filter.apply}
          </button>
          {filtered && (
            <Link href={`/admin/catalogos?kind=${kind}`} className={btnQuiet} data-testid="link-catalog-filter-clear">
              {t.filter.clear}
            </Link>
          )}
        </div>
      </form>

      {list.failed ? (
        <Notice testId="notice-catalog-error">{admin.common.loadError}</Notice>
      ) : list.rows.length === 0 ? (
        <p className="paper rounded-2xl border p-5 text-sm text-muted-foreground" data-testid="text-catalog-empty">
          {t.list.empty}
        </p>
      ) : (
        <CatalogList kind={kind} rows={list.rows} />
      )}

      <p className="text-sm text-muted-foreground">{t.syntheticNote}</p>

      {!list.failed && (list.total > 0 || page > 1) && (
        <Pager basePath="/admin/catalogos" params={{ kind, q: q || undefined, parent: parent ?? undefined }} page={page} total={list.total} />
      )}
    </AdminShell>
  );
}
