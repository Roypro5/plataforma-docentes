import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { PageHeader, Section } from "@/components/foundation/page-header";
import { Notice } from "@/components/cuenta/notice";
import { btnPrimary, btnQuiet } from "@/components/cuenta/styles";
import { PaymentStatusBadge } from "@/components/planes/status-badge";
import { TestPrice } from "@/components/planes/test-price";
import { requireActiveViewer } from "@/core/auth/viewer";
import { getPayment } from "@/core/billing/queries";
import { parsePaymentId, type PaymentRow } from "@/core/billing/schemas";
import { paymentOutcome, planName } from "@/core/billing/status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { planes } from "@/i18n/es-planes";

export const metadata = { title: "Resultado del pago" };

const t = planes.resultado;

// Esta página solo LEE el estado guardado del pago (get_payment). El parámetro ?pago= es un id:
// nunca indica ni acredita un resultado.
export default async function Resultado({ searchParams }: { searchParams: Promise<{ pago?: string | string[] }> }) {
  await requireActiveViewer();
  const id = parsePaymentId((await searchParams).pago);
  const supabase = (await createSupabaseServerClient())!;
  const lookup = id ? await getPayment(supabase, id) : ({ state: "not_found" } as const);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={t.title} lead={t.lead} crumb={t.crumb} />

      {lookup.state === "failed" ? (
        <Notice testId="notice-payment-error">{planes.common.error}</Notice>
      ) : lookup.state === "not_found" || !id ? (
        <Section title={t.invalidTitle}>
          <p className="text-sm text-muted-foreground" data-testid="text-result-invalid">{t.invalidBody}</p>
          <Link href="/planes" className={`${btnPrimary} mt-4`} data-testid="link-back-to-plans">
            {planes.common.backToPlans}
          </Link>
        </Section>
      ) : (
        <ResultCard id={id} payment={lookup.payment} />
      )}
    </div>
  );
}

function ResultCard({ id, payment }: { id: string; payment: PaymentRow }) {
  const outcome = paymentOutcome(payment.status);
  const text = t.outcome[payment.status];
  const Icon = outcome === "approved" ? CheckCircle2 : outcome === "pending" ? Clock : XCircle;
  return (
    <Section title={text.title}>
      <div data-testid={`section-result-${payment.status}`}>
        <p className="flex gap-2 text-sm leading-relaxed" data-testid="text-result-message">
          <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{text.body}</span>
        </p>

        <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{planes.sandbox.plan}</dt>
            <dd className="mt-1 text-sm font-semibold" data-testid="text-result-plan">{planName(payment.plan_code)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{planes.sandbox.amount}</dt>
            <dd className="mt-1 text-sm">
              <TestPrice amountMinor={payment.amount_minor} currency={payment.currency} label={planes.common.testAmountLabel} testId="text-result-amount" />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{planes.sandbox.status}</dt>
            <dd className="mt-1"><PaymentStatusBadge status={payment.status} testId="badge-payment-status" /></dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {outcome === "approved" && (
            <>
              <Link href="/modulos/demo" className={`${btnPrimary} w-full sm:w-auto`} data-testid="link-go-demo">
                {t.goDemo}
              </Link>
              <Link href="/mi-plan" className={`${btnQuiet} w-full sm:w-auto`} data-testid="link-my-plan-from-result">
                {planes.common.myPlan}
              </Link>
            </>
          )}
          {outcome === "retry" && (
            <Link href="/planes/checkout" className={`${btnPrimary} w-full sm:w-auto`} data-testid="link-retry">
              {t.retry}
            </Link>
          )}
          {outcome === "pending" && (
            <Link href={`/planes/sandbox/${id}`} className={`${btnPrimary} w-full sm:w-auto`} data-testid="link-back-to-sandbox">
              {t.backToSandbox}
            </Link>
          )}
          {outcome !== "approved" && (
            <Link href="/planes" className={`${btnQuiet} w-full sm:w-auto`} data-testid="link-back-to-plans">
              {planes.common.backToPlans}
            </Link>
          )}
        </div>
      </div>
    </Section>
  );
}
