import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { TestPrice } from "@/components/planes/test-price";
import { planName } from "@/core/billing/status";
import type { PlanRow } from "@/core/billing/schemas";
import { planes } from "@/i18n/es-planes";

const t = planes;

/** Lo que incluye un plan: la base base (Gratis) o «todo lo de Gratis» más los derechos del plan. */
export function planIncludes(plan: PlanRow): string[] {
  if (plan.plan_code === "gratis") return [t.includes.base];
  const rights = plan.entitlement_codes.map((code) => t.includes.entitlements[code] ?? t.includes.otherEntitlement);
  return [t.includes.all, ...rights];
}

/** Una tarjeta por plan (nunca una tabla: se lee bien a 360 px). */
export function PlanCard({ plan, current, children }: { plan: PlanRow; current: boolean; children?: ReactNode }) {
  const code = plan.plan_code;
  const priced = plan.amount_minor !== null && plan.currency !== null;
  return (
    <li className="paper flex flex-col gap-4 rounded-2xl border p-5 sm:p-6" data-testid={`card-plan-${code}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold" data-testid={`text-plan-name-${code}`}>{planName(code)}</h2>
        {current && (
          <span className="inline-flex rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary" data-testid={`badge-current-${code}`}>
            {t.planesPage.currentPlan}
          </span>
        )}
      </div>
      {t.planSummary[code] && <p className="text-sm text-muted-foreground">{t.planSummary[code]}</p>}

      <p className="text-lg" data-testid={`text-plan-price-${code}`}>
        {priced ? (
          <TestPrice amountMinor={plan.amount_minor!} currency={plan.currency!} period={plan.period} testId={`text-price-${code}`} />
        ) : (
          <span className="font-semibold" data-testid={`text-price-${code}`}>{t.planesPage.freePrice}</span>
        )}
      </p>

      <div>
        <h3 className="text-sm font-semibold">{t.planesPage.includesTitle}</h3>
        <ul className="mt-2 space-y-2" data-testid={`list-includes-${code}`}>
          {planIncludes(plan).map((line) => (
            <li key={line} className="flex gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
      {priced && <p className="text-xs leading-relaxed text-muted-foreground">{t.planesPage.periodNote}</p>}
      {children && <div className="mt-auto space-y-2">{children}</div>}
    </li>
  );
}
