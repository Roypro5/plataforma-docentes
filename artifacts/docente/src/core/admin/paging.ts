// Fixed in SQL too: every admin_list_* function returns 20 rows per page.
export const ADMIN_PAGE_SIZE = 20;

/** Page numbers start at 1; anything else (missing, negative, not a number) is page 1. */
export function parsePage(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = typeof raw === "string" && /^\d{1,6}$/.test(raw) ? Number(raw) : 1;
  return n >= 1 ? n : 1;
}

export function totalPages(total: number): number {
  return Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
}
