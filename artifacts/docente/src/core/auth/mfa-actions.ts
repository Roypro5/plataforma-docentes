"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/cuenta/styles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { es } from "@/i18n/es";
import { totpCodeSchema } from "./schemas";
import { getViewer, viewerCan } from "./viewer";

const t = es.cuenta.admin;

export type EnrollState = { factorId: string; qr: string; secret: string } | { error: string } | undefined;

async function adminClient() {
  const viewer = await getViewer();
  if (viewer.state !== "signed-in" || !viewerCan(viewer, "admin.access")) redirect("/panel");
  return (await createSupabaseServerClient())!;
}

export async function startTotpEnrollAction(): Promise<EnrollState> {
  const supabase = await adminClient();
  // Drop abandoned, never-verified enrollments so the factor limit is not exhausted.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error || !data) return { error: es.cuenta.common.genericError };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyTotpAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = totpCodeSchema.safeParse({ code: form.get("code") });
  const factorId = form.get("factorId");
  if (!parsed.success || typeof factorId !== "string") return { error: t.invalidCode };
  const supabase = await adminClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: parsed.data.code });
  if (error) return { error: t.invalidCode };
  redirect("/admin");
}
