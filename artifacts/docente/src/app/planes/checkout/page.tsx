import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader, Section } from "@/components/foundation/page-header";
import { Notice } from "@/components/cuenta/notice";
import { btnPrimary, btnQuiet } from "@/components/cuenta/styles";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { planIncludes } from "@/components/planes/plan-card";
import { TestPrice } from "@/components/planes/test-price";
import { requireActiveViewer } from "@/core/auth/viewer";
import { startCheckoutAction } from "@/core/billing/actions";
import { getMyPlan, listPlans, sandboxAvailable } from "@/core/billing/queries";
import { CHECKOUT_PLAN } from "@/core/billing/schemas";
import { planName } from "@/core/billing/status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { planes } from "@/i18n/es-planes";

export const metadata = { title: "Resumen de compra" };

const t = planes;

export default async function Checkout() {
  await requireActiveViewer();
  const supabase = (await createSupabaseServerClient())!;
  const [list, mine, sandbox] = await Promise.all([listPlans(supabase), getMyPlan(supabase), sandboxAvailable(supabase)]);

  const plan = list.plans.find((p) => p.plan_code === CHECKOUT_PLAN && p.amount_minor !== null && p.currency !== null);
  const hasIndividual = mine.plan?.plan_code === CHECKOUT_PLAN;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t.checkout.eyebrow} title={t.checkout.title} lead={t.checkout.lead} crumb={t.checkout.crumb} />

      <Notice testId="notice-test-prices">{t.common.testNotice}</Notice>

      {list.failed ? (
        <Notice testId="notice-plans-error">{t.common.error}</Notice>
      ) : hasIndividual ? (
        <Section title={t.checkout.alreadyTitle}>
          <p className="text-sm text-muted-foreground" data-testid="text-already-individual">{t.checkout.alreadyBody}</p>
          <Link href="/mi-plan" className={`${btnPrimary} mt-4`} data-testid="link-my-plan-from-checkout">
            {t.common.myPlan}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Section>
      ) : !plan ? (
        <Section title={t.planesPage.noPlans}>
          <p className="text-sm text-muted-foreground" data-testid="text-plan-unavailable">{t.checkout.notAvailable}</p>
        </Section>
      ) : !sandbox ? (
        <Section title={t.planesPage.sandboxOffTitle}>
          <p className="text-sm text-muted-foreground" data-testid="text-sandbox-off">{t.planesPage.sandboxOff}</p>
        </Section>
      ) : (
        <Section title={t.checkout.summaryTitle}>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3" data-testid="summary-checkout">
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.checkout.plan}</dt>
              <dd className="mt-1 text-sm font-semibold" data-testid="text-checkout-plan">{planName(plan.plan_code)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.checkout.price}</dt>
              <dd className="mt-1 text-sm">
                <TestPrice amountMinor={plan.amount_minor!} currency={plan.currency!} period={plan.period} testId="text-checkout-price" />
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.checkout.period}</dt>
              <dd className="mt-1 text-sm" data-testid="text-checkout-period">
                {(plan.period && t.common.periodName[plan.period]) || "—"}
              </dd>
            </div>
          </dl>
          <ul className="mt-5 space-y-2 text-sm" data-testid="list-checkout-includes">
            {planIncludes(plan).map((line) => <li key={line}>{line}</li>)}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground" data-testid="text-checkout-terms">
            {t.common.noAutoRenewal} {t.checkout.cancelInfo}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start">
            <ConfirmForm
              action={startCheckoutAction}
              fields={{}}
              label={<>{t.checkout.continue}<ArrowRight className="h-4 w-4" aria-hidden /></>}
              className={`${btnPrimary} w-full sm:w-auto`}
              testId="button-start-checkout"
            />
            <Link href="/planes" className={`${btnQuiet} w-full sm:w-auto`} data-testid="link-back-to-plans">
              {t.common.backToPlans}
            </Link>
          </div>
        </Section>
      )}
    </div>
  );
}
