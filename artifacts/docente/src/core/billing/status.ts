// Estados de pago y errores de la etapa 5 → qué mostrar. Funciones puras.
import { planes, type PlanesErrorKey } from "../../i18n/es-planes";
import type { PaymentStatus } from "./schemas";

export type PaymentOutcome = "approved" | "pending" | "retry";

/** approved → acceso; pending → sigue abierto; el resto (rechazado, cancelado, vencido) → intentar de nuevo. */
export function paymentOutcome(status: PaymentStatus): PaymentOutcome {
  if (status === "approved") return "approved";
  if (status === "pending") return "pending";
  return "retry";
}

/** Un pago resuelto (o vencido) ya no se puede cambiar: la pasarela no ofrece botones. */
export function isPaymentOpen(status: PaymentStatus): boolean {
  return status === "pending";
}

export function paymentStatusLabel(status: string): string {
  return planes.paymentStatus[status] ?? status;
}

export function planName(code: string): string {
  return planes.planNames[code] ?? code;
}

// Códigos de PostgreSQL de las funciones de la etapa 5 (docs/architecture/etapa-5-contrato.md).
const byCode: Record<string, PlanesErrorKey> = {
  "42501": "denied",
  "22023": "invalid",
  P0002: "notFound",
  "23514": "conflict",
};

export function billingErrorKey(code: string | undefined | null): PlanesErrorKey {
  return (code && byCode[code]) || "generic";
}

/** Mensaje visible; cada acción puede dar un texto más específico para algunas claves. */
export function billingErrorMessage(code: string | undefined | null, overrides?: Partial<Record<PlanesErrorKey, string>>): string {
  const key = billingErrorKey(code);
  return overrides?.[key] ?? planes.errors[key];
}
