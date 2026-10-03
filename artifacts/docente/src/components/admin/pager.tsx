import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { btnQuiet } from "@/components/cuenta/styles";
import { totalPages } from "@/core/admin/paging";
import { admin } from "@/i18n/es-admin";

const t = admin.pager;

/**
 * Previous/next links that keep the current filters. `params` are the active filters (without
 * `page`); empty values are dropped from the URL.
 */
export function Pager({
  basePath,
  params,
  page,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  total: number;
}) {
  const pages = totalPages(total);
  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav aria-label={t.label} className="flex flex-wrap items-center justify-between gap-3 text-sm" data-testid="pager">
      <p className="text-muted-foreground">
        {t.total(total)} · {t.page(Math.min(page, pages), pages)}
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(Math.min(page - 1, pages))} className={btnQuiet} rel="prev" data-testid="link-page-prev">
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {t.previous}
          </Link>
        )}
        {page < pages && (
          <Link href={href(page + 1)} className={btnQuiet} rel="next" data-testid="link-page-next">
            {t.next}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
    </nav>
  );
}
