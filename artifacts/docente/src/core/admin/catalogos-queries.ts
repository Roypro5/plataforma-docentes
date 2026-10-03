import "server-only";
import { adminCall } from "./rpc";
import type { CatalogKind } from "./catalogos-schemas";

const PERMISSION = "admin.catalogs.manage" as const;

export type CatalogRow = {
  id: string;
  kind: string;
  code: string | null;
  name: string;
  active: boolean;
  parent_id: string | null;
  parent_name: string | null;
  is_synthetic: boolean;
  source: string | null;
  total_count: number | string;
};

export async function listCatalog(
  kind: CatalogKind,
  parent: string | null,
  query: string,
  page: number,
): Promise<{ rows: CatalogRow[]; total: number; failed: boolean }> {
  const result = await adminCall<CatalogRow[]>(PERMISSION, "admin_list_catalog", {
    p_kind: kind,
    p_parent: parent,
    p_query: query === "" ? null : query,
    p_page: page,
  });
  if (!result.ok) return { rows: [], total: 0, failed: true };
  const rows = result.data ?? [];
  return { rows, total: rows.length > 0 ? Number(rows[0].total_count) : 0, failed: false };
}

const MAX_PARENT_PAGES = 10;

/** Every item of a kind (regions or levels), to fill the parent filter. The list is paginated, so it walks the pages (at most 200 items). */
export async function listAllCatalog(kind: CatalogKind): Promise<{ id: string; name: string }[]> {
  const items: { id: string; name: string }[] = [];
  for (let page = 1; page <= MAX_PARENT_PAGES; page++) {
    const { rows, total, failed } = await listCatalog(kind, null, "", page);
    if (failed) break;
    for (const r of rows) items.push({ id: r.id, name: r.name });
    if (rows.length === 0 || items.length >= total) break;
  }
  return items;
}
