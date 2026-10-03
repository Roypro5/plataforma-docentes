import Link from "next/link";
import type { AnnouncementRow } from "@/core/admin/avisos-queries";
import { formatLima } from "@/core/admin/avisos-dates";
import { btnQuiet } from "@/components/cuenta/styles";
import { adminAvisos } from "@/i18n/es-admin-avisos";
import { audienceText } from "./audience";
import { AnnouncementStatusBadge } from "./status-badge";

const t = adminAvisos.list;

// Cards instead of a table: they fit 360 px without horizontal scrolling.
export function AnnouncementList({ rows, countryNames }: { rows: AnnouncementRow[]; countryNames: Record<string, string> }) {
  return (
    <ul className="space-y-3" aria-label={t.label} data-testid="list-announcements">
      {rows.map((row) => (
        <li key={row.id} className="paper rounded-2xl border p-4 sm:p-5" data-testid={`row-announcement-${row.id}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <h2 className="break-words text-base font-semibold">{row.title}</h2>
              <AnnouncementStatusBadge status={row.status} />
            </div>
            <Link href={`/admin/avisos/${row.id}`} className={btnQuiet} aria-label={t.openFor(row.title)} data-testid={`link-announcement-${row.id}`}>
              {t.open}
            </Link>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="inline text-muted-foreground">{t.starts}: </dt>
              <dd className="inline">{formatLima(row.starts_at)}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">{t.ends}: </dt>
              <dd className="inline">{row.ends_at ? formatLima(row.ends_at) : t.noEnd}</dd>
            </div>
          </dl>
          <p className="mt-2 text-sm text-muted-foreground">{audienceText(row.country_codes, row.role_codes, row.plan_codes, countryNames)}</p>
        </li>
      ))}
    </ul>
  );
}
