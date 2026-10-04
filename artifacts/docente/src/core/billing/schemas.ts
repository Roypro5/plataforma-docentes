// Validación de la etapa 5. El navegador nunca envía importes ni estados de suscripción: solo ids
// de pago (uuid) y el resultado de la pasarela de prueba (enum cerrado).
import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const CHECKOUT_PLAN = "individual" as const;
export const checkoutPlanSchema = z.literal(CHECKOUT_PLAN);

export const SANDBOX_RESULTS = ["approved", "rejected", "pending", "canceled"] as const;
export const sandboxResultSchema = z.enum(SANDBOX_RESULTS);
export type SandboxResult = z.infer<typeof sandboxResultSchema>;

export const PAYMENT_STATUSES = ["pending", "approved", "rejected", "canceled", "expired"] as const;
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const resolvePaymentSchema = z.object({ pago: uuidSchema, resultado: sandboxResultSchema });

/** Un parámetro de URL o de formulario → uuid, o null si no lo es (incluye listas y vacío). */
export function parsePaymentId(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = uuidSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export const HISTORY_PAGE_SIZE = 20;

/** Los números de página empiezan en 1; todo lo demás (vacío, negativo, texto) es la página 1. */
export function parsePage(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = typeof raw === "string" && /^\d{1,6}$/.test(raw) ? Number(raw) : 1;
  return n >= 1 ? n : 1;
}

export function totalPages(total: number): number {
  return Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
}

// Las columnas int llegan como número; bigint (total_count) puede llegar como texto.
const intLike = z.union([z.number().int(), z.string().regex(/^-?\d+$/).transform(Number)]);
const text = z.string();

export const planRowSchema = z.object({
  plan_code: text,
  scope: text,
  price_id: z.string().nullable(),
  amount_minor: intLike.nullable(),
  currency: z.string().nullable(),
  period: z.string().nullable(),
  entitlement_codes: z.array(text).nullable().transform((v) => v ?? []),
  sort_order: intLike,
});
export type PlanRow = z.infer<typeof planRowSchema>;

export const myPlanRowSchema = z.object({
  plan_code: text,
  subscription_id: z.string().nullable(),
  status: z.string().nullable(),
  current_period_start: z.string().nullable(),
  current_period_end: z.string().nullable(),
  cancel_at_period_end: z.boolean().nullable().transform((v) => v ?? false),
  amount_minor: intLike.nullable(),
  currency: z.string().nullable(),
  pending_payment_id: z.string().nullable(),
});
export type MyPlanRow = z.infer<typeof myPlanRowSchema>;

export const paymentRowSchema = z.object({
  id: z.string(),
  status: paymentStatusSchema,
  plan_code: text,
  amount_minor: intLike,
  currency: text,
  expires_at: z.string().nullable(),
  created_at: z.string(),
  resolved_at: z.string().nullable(),
});
export type PaymentRow = z.infer<typeof paymentRowSchema>;

export const historyRowSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  resolved_at: z.string().nullable(),
  status: text,
  amount_minor: intLike,
  currency: text,
  plan_code: text,
  provider: text,
  total_count: intLike,
});
export type HistoryRow = z.infer<typeof historyRowSchema>;

/** Valida filas devueltas por una RPC. `null` si algo no cumple el esquema (fallo cerrado). */
export function parseRows<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S>[] | null {
  const parsed = z.array(schema).safeParse(data ?? []);
  return parsed.success ? parsed.data : null;
}
