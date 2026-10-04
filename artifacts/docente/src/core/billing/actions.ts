"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/cuenta/styles";
import { resolveAppEnv } from "@/core/modules/access";
import { planes } from "@/i18n/es-planes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CHECKOUT_PLAN, parsePaymentId, resolvePaymentSchema } from "./schemas";
import { billingErrorMessage } from "./status";

const t = planes;

// El navegador solo envía el id del pago y el resultado elegido; el plan es fijo y el importe,
// el estado y los derechos los decide la base de datos.

// Second defense next to app_private.sandbox_enabled(): in production no sandbox RPC is called.
function sandboxBlocked() {
  return resolveAppEnv(process.env.NEXT_PUBLIC_APP_ENV) === "production";
}

async function authorizedClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/ingresar?next=/planes");
  return supabase;
}

function revalidateBilling() {
  revalidatePath("/planes");
  revalidatePath("/mi-plan");
  revalidatePath("/panel");
  revalidatePath("/modulos/demo");
}

/** start_checkout('individual') → pasarela de prueba. Doble clic: la base devuelve el mismo pago. */
export async function startCheckoutAction(): Promise<FormState> {
  if (sandboxBlocked()) return { error: t.errors.denied };
  const supabase = await authorizedClient();
  if (!supabase) return { error: t.errors.generic };
  const { data, error } = await supabase.rpc("start_checkout", { p_plan: CHECKOUT_PLAN });
  if (error) return { error: billingErrorMessage(error.code, { invalid: t.errors.checkoutInvalid }) };
  const paymentId = parsePaymentId(data);
  if (!paymentId) return { error: t.errors.generic };
  revalidateBilling();
  redirect(`/planes/sandbox/${paymentId}`);
}

/** Pasarela de prueba: el usuario elige el resultado; la base aplica o ignora (pago ya resuelto). */
export async function resolveSandboxPaymentAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = resolvePaymentSchema.safeParse({ pago: form.get("pago"), resultado: form.get("resultado") });
  if (!parsed.success) return { error: t.errors.invalid };
  if (sandboxBlocked()) return { error: t.errors.denied };
  const supabase = await authorizedClient();
  if (!supabase) return { error: t.errors.generic };
  const { error } = await supabase.rpc("sandbox_resolve_payment", { p_payment: parsed.data.pago, p_result: parsed.data.resultado });
  if (error) return { error: billingErrorMessage(error.code) };
  revalidateBilling();
  redirect(`/planes/resultado?pago=${parsed.data.pago}`);
}

export async function cancelSubscriptionAction(): Promise<FormState> {
  const supabase = await authorizedClient();
  if (!supabase) return { error: t.errors.generic };
  const { error } = await supabase.rpc("cancel_subscription");
  if (error) return { error: billingErrorMessage(error.code, { notFound: t.errors.cancelNone, conflict: t.errors.cancelAlready }) };
  revalidateBilling();
  return { ok: t.miPlan.canceled };
}

export async function resumeSubscriptionAction(): Promise<FormState> {
  const supabase = await authorizedClient();
  if (!supabase) return { error: t.errors.generic };
  const { error } = await supabase.rpc("resume_subscription");
  if (error) return { error: billingErrorMessage(error.code, { notFound: t.errors.resumeNone, conflict: t.errors.resumeNone }) };
  revalidateBilling();
  return { ok: t.miPlan.resumed };
}
