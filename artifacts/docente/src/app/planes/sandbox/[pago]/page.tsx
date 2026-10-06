import Link from "next/link";
import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/foundation/page-header";
import { Notice } from "@/components/cuenta/notice";
import { btnPrimary, btnQuiet } from "@/components/cuenta/styles";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { PaymentStatusBadge } from "@/components/planes/status-badge";
import { TestPrice } from "@/components/planes/test-price";
import { requireActiveViewer } from "@/core/auth/viewer";
import { resolveSandboxPaymentAction } from "@/core/billing/actions";
import { formatDateTimeLima } from "@/core/billing/format";
import { getPayment, sandboxAvailable } from "@/core/billing/queries";
import { parsePaymentId, type SandboxResult } from "@/core/billing/schemas";
import { isPaymentOpen, planName } from "@/core/billing/status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { planes } from "@/i18n/es-planes";
import { requireBilling } from "@/config/feature-guards";

export const metadata = { title: "Pasarela de prueba (sandbox)" };

const t = planes.sandbox;

const choices: { result: SandboxResult; label: string; primary: boolean }[] = [
  { result: "approved", label: t.approve, primary: true },
  { result: "rejected", label: t.reject, primary: false },
  { result: "pending", label: t.leavePending, primary: false },
  { result: "canceled", label: t.cancel, primary: false },
];

export default async function Sandbox({ params }: { params: Promise<{ pago: string }> }) {
  requireBilling();
  const id = parsePaymentId((await params).pago);
  if (!id) notFound();
  await requireActiveViewer();
  const supabase = (await createSupabaseServerClient())!;
  const [lookup, sandbox] = await Promise.all([getPayment(supabase, id), sandboxAvailable(supabase)]);
  if (lookup.state === "not_found") notFound();

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={t.title} lead={t.lead} crumb={t.crumb} />

      {lookup.state === "failed" ? (
        <Notice testId="notice-payment-error">{planes.common.error}</Notice>
      ) : (
        <section
          className="rise rounded-2xl border-2 border-dashed border-accent bg-accent-soft/40 p-5 sm:p-6"
          aria-label={t.title}
          data-testid="section-sandbox"
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1 text-xs font-bold tracking-[0.16em] text-background" data-testid="badge-sandbox">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden />
              {t.tag}
            </span>
            <p className="text-sm font-medium" data-testid="text-sandbox-banner">{t.banner}</p>
          </div>

          <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.plan}</dt>
              <dd className="mt-1 text-sm font-semibold" data-testid="text-sandbox-plan">{planName(lookup.payment.plan_code)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.amount}</dt>
              <dd className="mt-1 text-sm">
                <TestPrice
                  amountMinor={lookup.payment.amount_minor}
                  currency={lookup.payment.currency}
                  label={planes.common.testAmountLabel}
                  testId="text-sandbox-amount"
                />
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.status}</dt>
              <dd className="mt-1"><PaymentStatusBadge status={lookup.payment.status} testId="badge-payment-status" /></dd>
            </div>
            {isPaymentOpen(lookup.payment.status) && lookup.payment.expires_at && (
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.expires}</dt>
                <dd className="mt-1 text-sm" data-testid="text-sandbox-expires">{formatDateTimeLima(lookup.payment.expires_at)}</dd>
              </div>
            )}
          </dl>

          {!isPaymentOpen(lookup.payment.status) ? (
            <div className="mt-6 space-y-3" data-testid="section-sandbox-resolved">
              <p className="font-semibold">{t.resolvedTitle}</p>
              <p className="text-sm text-muted-foreground">{t.resolvedBody}</p>
              <Link href={`/planes/resultado?pago=${id}`} className={btnPrimary} data-testid="link-see-result">
                {t.seeResult}
              </Link>
            </div>
          ) : !sandbox ? (
            <div className="mt-6 space-y-1" data-testid="text-sandbox-off">
              <p className="font-semibold">{t.offTitle}</p>
              <p className="text-sm text-muted-foreground">{t.offBody}</p>
            </div>
          ) : (
            <div className="mt-6">
              <h2 className="font-display text-lg font-semibold">{t.chooseTitle}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="group-sandbox-actions">
                {choices.map(({ result, label, primary }) => (
                  <ConfirmForm
                    key={result}
                    action={resolveSandboxPaymentAction}
                    fields={{ pago: id, resultado: result }}
                    label={label}
                    className={`${primary ? btnPrimary : btnQuiet} w-full`}
                    testId={`button-sandbox-${result}`}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <Link href="/planes" className={btnQuiet} data-testid="link-back-to-plans">
        {planes.common.backToPlans}
      </Link>
    </div>
  );
}
