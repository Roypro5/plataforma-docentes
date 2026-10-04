import { formatPrice } from "@/core/billing/format";
import { planes } from "@/i18n/es-planes";

/** Importe de prueba: siempre lleva la etiqueta, porque nunca es un cobro real. */
export function TestPrice({
  amountMinor,
  currency,
  period,
  label = planes.common.testLabel,
  testId,
}: {
  amountMinor: number;
  currency: string;
  period?: string | null;
  label?: string;
  testId: string;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="break-words font-semibold" data-testid={testId}>
        {formatPrice(amountMinor, currency, period)}
      </span>
      <span className="inline-flex rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent" data-testid={`${testId}-label`}>
        {label}
      </span>
    </span>
  );
}
