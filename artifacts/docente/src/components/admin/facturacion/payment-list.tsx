import { StatusPill, TestAmount } from "@/components/admin/facturacion/billing-parts";
import { formatLimaDateTime, type PaymentRow } from "@/core/admin/facturacion-schemas";
import { adminFacturacion } from "@/i18n/es-admin-facturacion";

const t = adminFacturacion;

function providerLabel(code: string): string {
  return (t.providers as Record<string, string>)[code] ?? code;
}

/** One payment as a card: readable at 360 px and on desktop. No actions: the section is read-only. */
function PaymentCard({ row }: { row: PaymentRow }) {
  return (
    <li className="paper rounded-2xl border p-4 sm:p-5" data-testid={`row-payment-${row.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 break-all font-semibold" data-testid={`text-payment-email-${row.id}`}>
          {row.email ?? t.payments.noEmail}
        </h3>
        <StatusPill status={row.status} label={t.paymentStatus[row.status] ?? row.status} testId={`text-payment-status-${row.id}`} />
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{t.payments.amount}</dt>
          <dd>
            <TestAmount amountMinor={row.amount_minor} currency={row.currency} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.payments.provider}</dt>
          <dd>{providerLabel(row.provider)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted-foreground">{t.payments.reference}</dt>
          <dd className="break-all">{row.provider_reference ?? t.payments.noReference}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.payments.createdAt}</dt>
          <dd>{formatLimaDateTime(row.created_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.payments.resolvedAt}</dt>
          <dd>{formatLimaDateTime(row.resolved_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.payments.expiresAt}</dt>
          <dd>{formatLimaDateTime(row.expires_at)}</dd>
        </div>
      </dl>
    </li>
  );
}

export function PaymentList({ rows }: { rows: PaymentRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="paper rounded-2xl border p-5 text-sm text-muted-foreground" data-testid="text-payments-empty">
        {t.payments.empty}
      </p>
    );
  }
  return (
    <section aria-labelledby="payments-heading">
      <h2 id="payments-heading" className="sr-only">
        {t.payments.label}
      </h2>
      <ul className="space-y-3" data-testid="list-payments">
        {rows.map((row) => (
          <PaymentCard key={row.id} row={row} />
        ))}
      </ul>
    </section>
  );
}
