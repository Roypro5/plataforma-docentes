"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/cuenta/styles";
import { es } from "@/i18n/es";
import { safeNextPath } from "./routes";
import { recoverSchema, resetSchema, signInSchema, signUpSchema, totpCodeSchema } from "./schemas";

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

// Minimal activity log. A failure here must never block the sign-in.
async function recordSessionStarted(supabase: Awaited<ReturnType<typeof client>>) {
  try {
    await supabase.rpc("record_session_started");
  } catch {
    // Ignored on purpose.
  }
}

export async function signInAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: t.ingresar.invalid };
  const supabase = await client();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: t.ingresar.invalid };
  await recordSessionStarted(supabase);
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
  if (error?.code === "over_email_send_rate_limit") return { error: t.common.emailRateLimit };
  // Same answer whether or not the email exists, to avoid account enumeration.
  if (error && error.code !== "user_already_exists" && error.code !== "email_exists") return { error: t.common.genericError };
  return { ok: t.registro.sent };
}

export async function recoverAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = recoverSchema.safeParse({ email: form.get("email") });
  if (!parsed.success) return { error: t.registro.invalid };
  const supabase = await client();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: await callbackUrl("/restablecer") });
  // The project-wide send limit says nothing about whether this email has an account.
  if (error?.code === "over_email_send_rate_limit") return { error: t.common.emailRateLimit };
  return { ok: t.recuperar.sent };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { error: t.restablecer.mismatch };
  const supabase = await client();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: t.restablecer.noSession };

  // With MFA enrolled, Supabase only changes the password from an aal2 session; the
  // recovery link alone gives aal1, so verify the TOTP code first.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal.nextLevel === "aal2") {
    const code = totpCodeSchema.safeParse({ code: form.get("code") });
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.find((f) => f.status === "verified");
    if (!code.success || !factor) return { error: t.restablecer.invalidCode };
    const verified = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.data.code });
    if (verified.error) return { error: t.restablecer.invalidCode };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error?.code === "same_password") return { error: t.restablecer.samePassword };
  if (error?.code === "weak_password") return { error: t.restablecer.weakPassword };
  if (error?.code === "insufficient_aal") return { error: t.restablecer.invalidCode };
  if (error?.code === "reauthentication_needed") return { error: t.restablecer.reauth };
  if (error) return { error: t.common.genericError };
  redirect("/perfil");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut({ scope: "local" });
  redirect("/ingresar");
}
