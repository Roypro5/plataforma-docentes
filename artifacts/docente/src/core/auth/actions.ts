"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/cuenta/styles";
import { es } from "@/i18n/es";
import { safeNextPath } from "./routes";
import { recoverSchema, resetSchema, signInSchema, signUpSchema } from "./schemas";

const t = es.cuenta;

// Supabase only redirects to URLs on the project's allow list, so a forged Host header
// cannot send auth links elsewhere.
async function callbackUrl(next: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}/api/v1/auth/callback?next=${encodeURIComponent(next)}`;
}

async function client() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase Auth is not configured");
  return supabase;
}

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: t.ingresar.invalid };
  const supabase = await client();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: t.ingresar.invalid };
  redirect(safeNextPath(form.get("next")));
}

export async function signInWithGoogleAction(form: FormData) {
  const supabase = await client();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: await callbackUrl(safeNextPath(form.get("next"))) },
  });
  if (error || !data.url) redirect("/ingresar?error=google");
  redirect(data.url);
}

export async function signUpAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: t.registro.invalid };
  const supabase = await client();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: await callbackUrl("/bienvenida") },
  });
  if (error?.code === "weak_password" || error?.code === "validation_failed") return { error: t.registro.invalid };
  // Same answer whether or not the email exists, to avoid account enumeration.
  if (error && error.code !== "user_already_exists" && error.code !== "email_exists") return { error: t.common.genericError };
  return { ok: t.registro.sent };
}

export async function recoverAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = recoverSchema.safeParse({ email: form.get("email") });
  if (!parsed.success) return { error: t.registro.invalid };
  const supabase = await client();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: await callbackUrl("/restablecer") });
  return { ok: t.recuperar.sent };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { error: t.restablecer.mismatch };
  const supabase = await client();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: t.restablecer.noSession };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: t.common.genericError };
  redirect("/perfil");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut({ scope: "local" });
  redirect("/ingresar");
}
