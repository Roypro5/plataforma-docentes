import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { features } from "@/config/features";
import {
  historyRowSchema,
  myPlanRowSchema,
  paymentRowSchema,
  planRowSchema,
  parseRows,
  type HistoryRow,
  type MyPlanRow,
  type PaymentRow,
  type PlanRow,
} from "./schemas";

// Todas las funciones usan el cliente del usuario: la base calcula precio, estado y derechos y
// aplica la expiración perezosa. Un error o una fila inesperada es `failed` (fallo cerrado).

export async function listPlans(supabase: SupabaseClient): Promise<{ plans: PlanRow[]; failed: boolean }> {
  const { data, error } = await supabase.rpc("list_plans");
  const rows = error ? null : parseRows(planRowSchema, data);
  if (!rows) return { plans: [], failed: true };
  return { plans: [...rows].sort((a, b) => a.sort_order - b.sort_order), failed: false };
}

export async function getMyPlan(supabase: SupabaseClient): Promise<{ plan: MyPlanRow | null; failed: boolean }> {
  const { data, error } = await supabase.rpc("my_plan");
  const rows = error ? null : parseRows(myPlanRowSchema, data);
  if (!rows || rows.length === 0) return { plan: null, failed: true };
  return { plan: rows[0], failed: false };
}

/** `false` también cuando la consulta falla: sin confirmación no se ofrece el checkout. */
export async function sandboxAvailable(supabase: SupabaseClient): Promise<boolean> {
  // Second defense: production never offers sandbox payments, whatever the database answers.
  if (!features.billing) return false;
  const { data, error } = await supabase.rpc("sandbox_available");
  return !error && data === true;
}

export type PaymentLookup =
  | { state: "ok"; payment: PaymentRow }
  | { state: "not_found" }
  | { state: "failed" };

/** Estado guardado de un pago propio. `not_found` cubre un id ajeno o inexistente (P0002). */
export async function getPayment(supabase: SupabaseClient, id: string): Promise<PaymentLookup> {
  const { data, error } = await supabase.rpc("get_payment", { p_payment: id });
  if (error) return error.code === "P0002" ? { state: "not_found" } : { state: "failed" };
  const rows = parseRows(paymentRowSchema, data);
  if (!rows) return { state: "failed" };
  return rows.length === 0 ? { state: "not_found" } : { state: "ok", payment: rows[0] };
}

export async function listMyPayments(
  supabase: SupabaseClient,
  page: number,
): Promise<{ items: HistoryRow[]; total: number; failed: boolean }> {
  const { data, error } = await supabase.rpc("list_my_payments", { p_page: page });
  const rows = error ? null : parseRows(historyRowSchema, data);
  if (!rows) return { items: [], total: 0, failed: true };
  return { items: rows, total: rows[0]?.total_count ?? 0, failed: false };
}
