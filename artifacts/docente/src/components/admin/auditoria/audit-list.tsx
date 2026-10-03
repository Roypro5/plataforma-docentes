import { actionLabel, actorLabel, formatDetails, formatLimaDateTime, resourceLabel, resultLabel } from "@/core/admin/auditoria-format";
import type { AuditRow } from "@/core/admin/auditoria-schemas";
import { adminAuditoria } from "@/i18n/es-admin-auditoria";

const t = adminAuditoria;

const resultStyle: Record<string, string> = {
  success: "bg-primary-soft text-primary",
  denied: "bg-accent-soft text-foreground",
  error: "bg-danger-soft text-danger",
};

/** One record as a card. Every value is rendered as a text node: nothing here is HTML. */
function AuditCard({ row }: { row: AuditRow }) {
  const details = formatDetails(row.details);
  return (
    <li className="paper rounded-2xl border p-4 sm:p-5" data-testid={`row-audit-${row.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold" data-testid={`text-audit-action-${row.id}`}>
            {actionLabel(row.action)}
          </h3>
          <p className="break-all text-xs text-muted-foreground">{row.action}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${resultStyle[row.result] ?? "bg-muted"}`} data-testid={`text-audit-result-${row.id}`}>
          {resultLabel(row.result)}
        </span>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">{t.list.when}</dt>
          <dd data-testid={`text-audit-when-${row.id}`}>
            <time dateTime={row.occurred_at}>{formatLimaDateTime(row.occurred_at)}</time>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">{t.list.actor}</dt>
          <dd className="break-all" data-testid={`text-audit-actor-${row.id}`}>
            {actorLabel(row)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">{t.list.resource}</dt>
          <dd className="break-all" data-testid={`text-audit-resource-${row.id}`}>
            {resourceLabel(row.resource_type, row.resource_id)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 border-t pt-3 text-sm">
        <p className="text-muted-foreground">{t.list.details}</p>
        {details.length === 0 ? (
          <p className="mt-1">{t.list.noDetails}</p>
        ) : (
          <ul className="mt-1 space-y-1" data-testid={`list-audit-details-${row.id}`}>
            {details.map((d) => (
              <li key={d.key} className="break-all">
                <span className="font-medium">{d.label}:</span> {d.value}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function AuditList({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="paper rounded-2xl border p-5 text-sm text-muted-foreground" data-testid="text-audit-empty">
        {t.list.empty}
      </p>
    );
  }
  return (
    <section aria-labelledby="audit-heading">
      <h2 id="audit-heading" className="sr-only">
        {t.list.label}
      </h2>
      <ul className="space-y-3" data-testid="list-audit">
        {rows.map((row) => (
          <AuditCard key={String(row.id)} row={row} />
        ))}
      </ul>
    </section>
  );
}
