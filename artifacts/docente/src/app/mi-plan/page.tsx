import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, Section } from "@/components/foundation/page-header";
import { Notice } from "@/components/cuenta/notice";
import { btnPrimary, btnQuiet } from "@/components/cuenta/styles";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { PaymentStatusBadge } from "@/components/planes/status-badge";
import { TestPrice } from "@/components/planes/test-price";
import { requireActiveViewer } from "@/core/auth/viewer";
import { cancelSubscriptionAction, resumeSubscriptionAction } from "@/core/billing/actions";
import { formatDateLima, formatDateTimeLima } from "@/core/billing/format";
import { getMyPlan, listMyPayments } from "@/core/billing/queries";
import { CHECKOUT_PLAN, parsePage, totalPages } from "@/core/billing/schemas";
import { planName } from "@/core/billing/status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { planes } from "@/i18n/es-planes";
import { requireBilling } from "@/config/feature-guards";

export const metadata = { title: "Mi plan" };

const t = planes.miPlan;

export default async function MiPlan({ searchParams }: { searchParams: Promise<{ pagina?: string | string[] }> }) {
  requireBilling();
  await requireActiveViewer();
  const supabase = (await createSupabaseServerClient())!;
  const page = parsePage((await searchParams).pagina);
  const [mine, history] = await Promise.all([getMyPlan(supabase), listMyPayments(supabase, page)]);

  const plan = mine.plan;
  const paid = plan !== null && plan.plan_code !== "gratis";
  const periodEnd = formatDateLima(plan?.current_period_end);
  const pages = totalPages(history.total);
  const href = (n: number) => (n <= 1 ? "/mi-plan" : `/mi-plan?pagina=${n}`);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={t.title} lead={t.lead} crumb={t.title} />

      <Notice testId="notice-test-prices">{planes.common.testNotice}</Notice>

      <Section title={t.currentTitle}>
        {mine.failed || !plan ? (
          <Notice testId="notice-plan-error">{planes.common.error}</Notice>
        ) : (
          <div className="space-y-5" data-testid="section-current-plan">
            <p className="font-display text-2xl font-semibold" data-testid="text-current-plan-name">{planName(plan.plan_code)}</p>

            {!paid ? (
              <>
                <p className="text-sm text-muted-foreground" data-testid="text-free-plan">{t.freeBody}</p>
                <Link href="/planes" className={btnPrimary} data-testid="link-see-plans">{t.seePlans}</Link>
              </>
            ) : (
              <>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.period}</dt>
                    <dd className="mt-1 text-sm" data-testid="text-period">
                      {t.periodRange(formatDateLima(plan.current_period_start), periodEnd)}
                    </dd>
                  </div>
                  {plan.amount_minor !== null && plan.currency !== null && (
                    <div className="min-w-0">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.price}</dt>
                      <dd className="mt-1 text-sm">
                        <TestPrice amountMinor={plan.amount_minor} currency={plan.currency} period="month" testId="text-my-price" />
                      </dd>
                    </div>
                  )}
                </dl>
                <p className="text-sm text-muted-foreground" data-testid="text-access-until">
                  {t.accessUntil(periodEnd)} {planes.common.noAutoRenewal}
                </p>

                {plan.cancel_at_period_end ? (
                  <div className="space-y-3 rounded-xl bg-accent-soft p-4">
                    <p className="font-semibold" data-testid="text-cancels-on">{t.cancelsOn(periodEnd)}</p>
                    <p className="text-sm text-muted-foreground">{t.cancelsNote}</p>
                    <ConfirmForm
                      action={resumeSubscriptionAction}
                      fields={{}}
                      label={t.resume}
                      className={`${btnPrimary} w-full sm:w-auto`}
                      testId="button-resume-subscription"
                    />
                  </div>
                ) : (
                  plan.plan_code === CHECKOUT_PLAN && (
                    <ConfirmForm
                      action={cancelSubscriptionAction}
                      fields={{}}
                      label={t.cancel}
                      confirmTitle={t.cancelTitle}
                      confirmBody={t.cancelBody(periodEnd)}
                      confirmLabel={t.cancelConfirm}
                      className={`${btnQuiet} w-full sm:w-auto`}
                      testId="button-cancel-subscription"
                    />
                  )
                )}
              </>
            )}

            {plan.pending_payment_id && (
              <div className="space-y-2 rounded-xl border-2 border-dashed border-accent p-4" data-testid="section-pending-payment">
                <p className="font-semibold">{t.pendingTitle}</p>
                <p className="text-sm text-muted-foreground">{t.pendingBody}</p>
                <Link href={`/planes/sandbox/${plan.pending_payment_id}`} className={`${btnPrimary} w-full sm:w-auto`} data-testid="link-continue-pending">
                  {t.continuePending}
                </Link>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title={t.historyTitle}>
        {history.failed ? (
          <Notice testId="notice-history-error">{planes.common.error}</Notice>
        ) : history.items.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-payments-empty">{t.historyEmpty}</p>
        ) : (
          <ul aria-label={t.historyList} className="space-y-3" data-testid="list-payments">
            {history.items.map((p) => (
              <li key={p.id} className="rounded-xl border bg-surface p-4" data-testid="card-payment">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold" data-testid="text-payment-date">{formatDateTimeLima(p.created_at)}</p>
                  <PaymentStatusBadge status={p.status} testId="badge-payment-status" />
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.paymentPlan}</dt>
                    <dd className="mt-0.5 text-sm" data-testid="text-payment-plan">{planName(p.plan_code)}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{planes.sandbox.amount}</dt>
                    <dd className="mt-0.5 text-sm">
                      <TestPrice amountMinor={p.amount_minor} currency={p.currency} label={planes.common.testAmountLabel} testId="text-payment-amount" />
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}

        {(page > 1 || pages > 1) && (
          <nav aria-label={planes.common.pagination} className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {page > 1 ? (
              <Link href={href(page - 1)} rel="prev" className={btnQuiet} data-testid="link-prev-page">
                <ChevronLeft className="h-4 w-4" aria-hidden />{planes.common.previous}
              </Link>
            ) : <span />}
            <span className="text-sm text-muted-foreground" aria-current="page" data-testid="text-page">{planes.common.pageOf(page, pages)}</span>
            {page < pages ? (
              <Link href={href(page + 1)} rel="next" className={btnQuiet} data-testid="link-next-page">
                {planes.common.next}<ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : <span />}
          </nav>
        )}
      </Section>
    </div>
  );
}
