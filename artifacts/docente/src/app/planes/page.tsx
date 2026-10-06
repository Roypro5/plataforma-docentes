import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/foundation/page-header";
import { Notice } from "@/components/cuenta/notice";
import { btnPrimary, btnQuiet } from "@/components/cuenta/styles";
import { PlanCard } from "@/components/planes/plan-card";
import { requireActiveViewer } from "@/core/auth/viewer";
import { getMyPlan, listPlans, sandboxAvailable } from "@/core/billing/queries";
import { CHECKOUT_PLAN } from "@/core/billing/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { planes } from "@/i18n/es-planes";
import { requireBilling } from "@/config/feature-guards";

export const metadata = { title: "Planes" };

const t = planes;

export default async function Planes() {
  requireBilling();
  await requireActiveViewer();
  const supabase = (await createSupabaseServerClient())!;
  const [list, mine, sandbox] = await Promise.all([listPlans(supabase), getMyPlan(supabase), sandboxAvailable(supabase)]);

  const currentCode = mine.plan?.plan_code ?? null;
  const hasIndividual = currentCode === CHECKOUT_PLAN;
  const pendingPaymentId = mine.plan?.pending_payment_id ?? null;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t.planesPage.eyebrow} title={t.planesPage.title} lead={t.planesPage.lead} crumb={t.common.plans} />

      <Notice testId="notice-test-prices">{t.common.testNotice}</Notice>

      {list.failed ? (
        <Notice testId="notice-plans-error">{t.common.error}</Notice>
      ) : list.plans.length === 0 ? (
        <p className="paper rounded-2xl border p-5 text-sm text-muted-foreground" data-testid="text-plans-empty">{t.planesPage.noPlans}</p>
      ) : (
        <ul aria-label={t.planesPage.listLabel} className="grid gap-4 sm:grid-cols-2" data-testid="list-plans">
          {list.plans.map((plan) => {
            const code = plan.plan_code;
            const isIndividual = code === CHECKOUT_PLAN;
            return (
              <PlanCard key={code} plan={plan} current={currentCode === code}>
                {isIndividual && hasIndividual && (
                  <Link href="/mi-plan" className={btnQuiet} data-testid="link-my-plan-from-plans">
                    {t.planesPage.seeMyPlan}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                )}
                {isIndividual && !hasIndividual && sandbox && (
                  <>
                    <Link href="/planes/checkout" className={`${btnPrimary} w-full sm:w-auto`} data-testid="link-choose-individual">
                      {t.planesPage.choose}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                    {pendingPaymentId && (
                      <Link href={`/planes/sandbox/${pendingPaymentId}`} className={`${btnQuiet} w-full sm:w-auto`} data-testid="link-continue-pending">
                        {t.planesPage.continuePending}
                      </Link>
                    )}
                  </>
                )}
                {isIndividual && !hasIndividual && !sandbox && (
                  <p className="rounded-xl bg-muted p-3 text-sm" data-testid="text-sandbox-off">
                    <span className="font-semibold">{t.planesPage.sandboxOffTitle}. </span>
                    {t.planesPage.sandboxOff}
                  </p>
                )}
              </PlanCard>
            );
          })}
        </ul>
      )}
    </div>
  );
}
