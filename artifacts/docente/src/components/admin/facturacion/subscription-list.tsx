import { StatusPill, TestAmount } from "@/components/admin/facturacion/billing-parts";
import { formatLimaDateTime, type SubscriptionRow } from "@/core/admin/facturacion-schemas";
import { adminFacturacion } from "@/i18n/es-admin-facturacion";

const t = adminFacturacion;

function planLabel(code: string): string {
  return (t.plans as Record<string, string>)[code] ?? code;
}

/** One subscription as a card: readable at 360 px and on desktop. No actions: the section is read-only. */
function SubscriptionCard({ row }: { row: SubscriptionRow }) {
  return (
    <li className="paper rounded-2xl border p-4 sm:p-5" data-testid={`row-subscription-${row.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 break-all font-semibold" data-testid={`text-subscription-email-${row.id}`}>
          {row.email ?? t.subscriptions.noEmail}
        </h3>
        <StatusPill
          status={row.status}
          label={t.subscriptionStatus[row.status] ?? row.status}
          testId={`text-subscription-status-${row.id}`}
        />
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{t.subscriptions.plan}</dt>
          <dd>{planLabel(row.plan_code)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.subscriptions.current}</dt>
          <dd>{row.is_current ? t.subscriptions.currentYes : t.subscriptions.currentNo}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.subscriptions.amount}</dt>
          <dd>
            <TestAmount amountMinor={row.amount_minor} currency={row.currency} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.subscriptions.cancelAtEnd}</dt>
          <dd>{row.cancel_at_period_end ? t.subscriptions.cancelYes : t.subscriptions.cancelNo}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.subscriptions.periodStart}</dt>
          <dd>{formatLimaDateTime(row.current_period_start)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.subscriptions.periodEnd}</dt>
          <dd>{formatLimaDateTime(row.current_period_end)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.subscriptions.createdAt}</dt>
          <dd>{formatLimaDateTime(row.created_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.subscriptions.activatedAt}</dt>
          <dd>{formatLimaDateTime(row.activated_at)}</dd>
        </div>
      </dl>
    </li>
  );
}

export function SubscriptionList({ rows }: { rows: SubscriptionRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="paper rounded-2xl border p-5 text-sm text-muted-foreground" data-testid="text-subscriptions-empty">
        {t.subscriptions.empty}
      </p>
    );
  }
  return (
    <section aria-labelledby="subscriptions-heading">
      <h2 id="subscriptions-heading" className="sr-only">
        {t.subscriptions.label}
      </h2>
      <ul className="space-y-3" data-testid="list-subscriptions">
        {rows.map((row) => (
          <SubscriptionCard key={row.id} row={row} />
        ))}
      </ul>
    </section>
  );
}
