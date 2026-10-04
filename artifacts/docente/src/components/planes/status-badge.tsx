import { paymentStatusLabel } from "@/core/billing/status";

// Solo pares de tokens que ya cumplen contraste AA en ambos temas.
const tone: Record<string, string> = {
  approved: "bg-primary-soft text-primary",
  pending: "bg-accent-soft text-accent",
  rejected: "bg-danger-soft text-danger",
  canceled: "bg-muted text-foreground",
  expired: "bg-muted text-foreground",
};

export function PaymentStatusBadge({ status, testId }: { status: string; testId: string }) {
  return (
    <span className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone[status] ?? "bg-muted text-foreground"}`} data-testid={testId}>
      {paymentStatusLabel(status)}
    </span>
  );
}
