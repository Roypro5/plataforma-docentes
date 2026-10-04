import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDenied } from "@/components/admin/denied";
import { BillingFiltersForm, BillingTabs } from "@/components/admin/facturacion/billing-filters";
import { PaymentList } from "@/components/admin/facturacion/payment-list";
import { SubscriptionList } from "@/components/admin/facturacion/subscription-list";
import { Pager } from "@/components/admin/pager";
import { Notice } from "@/components/cuenta/notice";
import { adminErrorMessage } from "@/core/admin/errors";
import { listPayments, listSubscriptions } from "@/core/admin/facturacion-queries";
import { pagerParams, parseBillingFilters } from "@/core/admin/facturacion-schemas";
import { requireAdmin } from "@/core/auth/viewer";
import { adminFacturacion } from "@/i18n/es-admin-facturacion";

export const metadata = { title: adminFacturacion.metaTitle };

const t = adminFacturacion;

export default async function AdminPlanesPagos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { viewer, allowed } = await requireAdmin("admin.billing.read");
  if (!allowed) {
    return (
      <AdminShell viewer={viewer} section="planes-pagos" title={t.title} lead={t.lead}>
        <AdminDenied />
      </AdminShell>
    );
  }

  const filters = parseBillingFilters(await searchParams);
  // Only the open block is requested, so each listing is audited only when it is looked at.
  const subscriptions = filters.tab === "suscripciones" ? await listSubscriptions(filters) : null;
  const payments = filters.tab === "pagos" ? await listPayments(filters) : null;
  const result = subscriptions ?? payments;
  const total = result?.ok ? result.data.total : 0;

  return (
    <AdminShell viewer={viewer} section="planes-pagos" title={t.title} lead={t.lead}>
      <p className="text-sm text-muted-foreground" data-testid="text-billing-test-note">
        {t.testNote}
      </p>
      <BillingTabs current={filters.tab} />
      <BillingFiltersForm filters={filters} />
      {result && !result.ok ? (
        <Notice testId="notice-billing-error">{adminErrorMessage(result.error)}</Notice>
      ) : (
        <>
          {subscriptions?.ok && <SubscriptionList rows={subscriptions.data.rows} />}
          {payments?.ok && <PaymentList rows={payments.data.rows} />}
          <Pager basePath="/admin/planes-pagos" params={pagerParams(filters)} page={filters.page} total={total} />
        </>
      )}
    </AdminShell>
  );
}
