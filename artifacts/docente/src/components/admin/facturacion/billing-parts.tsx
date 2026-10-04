import { formatMinorAmount } from "@/core/admin/facturacion-schemas";
import { adminFacturacion } from "@/i18n/es-admin-facturacion";

const t = adminFacturacion;

/** Amount with the «prueba» label: every figure in this section comes from the sandbox. */
export function TestAmount({ amountMinor, currency }: { amountMinor: number | null; currency: string | null }) {
  const amount = formatMinorAmount(amountMinor, currency);
  return <>{amount === t.noValue ? amount : t.amountTest(amount)}</>;
}

const statusStyle: Record<string, string> = {
  active: "bg-primary-soft text-primary",
  approved: "bg-primary-soft text-primary",
  pending: "bg-accent-soft text-foreground",
  incomplete: "bg-accent-soft text-foreground",
  rejected: "bg-danger-soft text-danger",
  expired: "bg-muted text-foreground",
  incomplete_expired: "bg-muted text-foreground",
  canceled: "bg-muted text-foreground",
};

export function StatusPill({ status, label, testId }: { status: string; label: string; testId?: string }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[status] ?? "bg-muted"}`} data-testid={testId}>
      {label}
    </span>
  );
}
