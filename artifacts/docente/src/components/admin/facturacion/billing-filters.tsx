import Link from "next/link";
import { Field } from "@/components/cuenta/form-ui";
import { btnPrimary, btnQuiet, fieldClass } from "@/components/cuenta/styles";
import {
  BILLING_TABS,
  PAYMENT_STATUSES,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUSES,
  type BillingFilters,
  type BillingTab,
} from "@/core/admin/facturacion-schemas";
import { admin } from "@/i18n/es-admin";
import { adminFacturacion } from "@/i18n/es-admin-facturacion";

const t = adminFacturacion;

function tabHref(tab: BillingTab): string {
  return tab === "suscripciones" ? "/admin/planes-pagos" : `/admin/planes-pagos?tab=${tab}`;
}

/** Two blocks selected by the query string. Plain links: no client state. */
export function BillingTabs({ current }: { current: BillingTab }) {
  return (
    <nav aria-label={t.tabs.label}>
      <ul className="flex flex-wrap gap-2">
        {BILLING_TABS.map((tab) => {
          const active = tab === current;
          return (
            <li key={tab}>
              <Link
                href={tabHref(tab)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold ${
                  active ? "bg-primary text-primary-foreground" : "border hover:bg-muted"
                }`}
                data-testid={`link-billing-tab-${tab}`}
              >
                {tab === "suscripciones" ? t.tabs.subscriptions : t.tabs.payments}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** GET form: filters travel in the query string, so results can be shared and the pager keeps them. */
export function BillingFiltersForm({ filters }: { filters: BillingFilters }) {
  const isPayments = filters.tab === "pagos";
  const active = Boolean(filters.status || filters.plan);
  const statuses: readonly string[] = isPayments ? PAYMENT_STATUSES : SUBSCRIPTION_STATUSES;
  const labels: Record<string, string> = isPayments ? t.paymentStatus : t.subscriptionStatus;
  return (
    <form
      method="get"
      action="/admin/planes-pagos"
      role="search"
      aria-label={t.filters.legend}
      className="paper space-y-4 rounded-2xl border p-4 sm:p-5"
      data-testid="form-billing-filters"
    >
      <input type="hidden" name="tab" value={filters.tab} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="billing-status" label={t.filters.status}>
          <select id="billing-status" name="status" defaultValue={filters.status ?? ""} className={fieldClass} data-testid="select-billing-status">
            <option value="">{admin.common.all}</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {labels[s]}
              </option>
            ))}
          </select>
        </Field>
        {!isPayments && (
          <Field id="billing-plan" label={t.filters.plan}>
            <select id="billing-plan" name="plan" defaultValue={filters.plan ?? ""} className={fieldClass} data-testid="select-billing-plan">
              <option value="">{admin.common.all}</option>
              {SUBSCRIPTION_PLANS.map((p) => (
                <option key={p} value={p}>
                  {t.plans[p]}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btnPrimary} data-testid="button-billing-filter">
          {t.filters.submit}
        </button>
        {active && (
          <Link href={tabHref(filters.tab)} className={btnQuiet} data-testid="link-billing-clear">
            {t.filters.clear}
          </Link>
        )}
      </div>
    </form>
  );
}
