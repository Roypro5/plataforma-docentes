"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/cuenta/styles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { es } from "@/i18n/es";
import { getModuleManifest, isModuleId } from "@/modules/registry";
import { applyEnvironment, resolveAppEnv } from "./access";
import { countUnread } from "./queries";

const t = es.modulos;
const NOT_ALLOWED = "42501";

const moduleIdSchema = z.string().refine(isModuleId);
const idsSchema = z.array(z.string().uuid()).min(1).max(100).nullable();

async function authorizedClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/ingresar?next=/panel");
  return supabase;
}

async function setInterest(rpc: "register_module_interest" | "withdraw_module_interest", form: FormData, ok: string): Promise<FormState> {
  const parsed = moduleIdSchema.safeParse(form.get("moduleId"));
  if (!parsed.success) return { error: t.notify.error };
  const supabase = await authorizedClient();
  if (!supabase) return { error: t.notify.error };
  // A dev-only module is never offered in production; the database resolves everything else.
  const manifest = getModuleManifest(parsed.data);
  if (manifest && applyEnvironment("coming_soon", manifest, resolveAppEnv(process.env.NEXT_PUBLIC_APP_ENV)) === "hidden") {
    return { error: t.notify.notAllowed };
  }
  const { error } = await supabase.rpc(rpc, { p_module: parsed.data });
  if (error) return { error: error.code === NOT_ALLOWED ? t.notify.notAllowed : t.notify.error };
  revalidatePath("/panel");
  return { ok };
}

export async function registerInterestAction(_: FormState, form: FormData): Promise<FormState> {
  return setInterest("register_module_interest", form, t.notify.registered);
}

export async function withdrawInterestAction(_: FormState, form: FormData): Promise<FormState> {
  return setInterest("withdraw_module_interest", form, t.notify.withdrawn);
}

/** `null` marks every unread notification of the user; otherwise only the given ids. The RPC limits it to the user's own. */
export async function markNotificationsReadAction(ids: string[] | null): Promise<FormState> {
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { error: t.notificaciones.error };
  const supabase = await authorizedClient();
  if (!supabase) return { error: t.notificaciones.error };
  const { error } = await supabase.rpc("mark_notifications_read", { p_ids: parsed.data });
  if (error) return { error: error.code === NOT_ALLOWED ? t.notify.notAllowed : t.notificaciones.error };
  revalidatePath("/notificaciones");
  revalidatePath("/panel");
  return { ok: parsed.data === null ? t.notificaciones.markedAll : t.notificaciones.markedOne };
}

// Form variants used with useActionState.
export async function markAllNotificationsReadFormAction(): Promise<FormState> {
  return markNotificationsReadAction(null);
}

export async function markOneNotificationReadFormAction(_: FormState, form: FormData): Promise<FormState> {
  return markNotificationsReadAction([String(form.get("id") ?? "")]);
}

/** Unread count for the shell bell. `null` when Supabase is unconfigured, the visitor is anonymous or the query fails. */
export async function getUnreadCountAction(): Promise<number | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return null;
  const { data: user } = await supabase.from("users").select("status").eq("id", data.claims.sub).maybeSingle();
  if (user?.status !== "active") return null;
  return countUnread(supabase);
}
