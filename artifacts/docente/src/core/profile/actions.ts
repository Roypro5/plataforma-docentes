"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/cuenta/styles";
import { legal } from "@/config/legal";
import { onboardingStep1Schema, onboardingStep2Schema, onboardingStep3Schema } from "@/core/auth/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasAcceptedCurrentLegal } from "./queries";
import { es } from "@/i18n/es";

const t = es.cuenta.onboarding;
const COHERENCE = "23514";

// Every write goes through RLS as the signed-in user; a suspended or deleted account
// updates zero rows, which is reported as a generic failure.
async function session() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase Auth is not configured");
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/ingresar?next=/bienvenida");
  const { data: profile } = await supabase.from("profiles").select("country_code, onboarding_step, onboarding_completed_at").eq("user_id", userId).maybeSingle();
  if (!profile) redirect("/cuenta-suspendida");
  return { supabase, userId, profile };
}

function nextStep(current: number, target: number) {
  return Math.max(current, target);
}

export async function saveStep1Action(_: FormState, form: FormData): Promise<FormState> {
  const parsed = onboardingStep1Schema.safeParse({
    displayName: form.get("displayName"),
    countryCode: form.get("countryCode"),
    acceptLegal: form.get("acceptLegal") ?? undefined,
  });
  if (!parsed.success) return { error: t.errorStep1 };
  const { supabase, userId, profile } = await session();

  if (!(await hasAcceptedCurrentLegal(supabase))) {
    if (parsed.data.acceptLegal !== "on") return { error: t.legalRequired };
    const { error } = await supabase.from("consent_records").insert([
      { user_id: userId, document: "terminos", version: legal.version },
      { user_id: userId, document: "privacidad", version: legal.version },
    ]);
    if (error) return { error: es.cuenta.common.genericError };
  }

  // Territory belongs to a country. Only PE is active today, so a change only happens
  // from an empty profile; switching countries with education choices will need an RPC
  // that clears them in the same transaction.
  const countryChanged = profile.country_code !== parsed.data.countryCode;
  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      country_code: parsed.data.countryCode,
      ...(countryChanged ? { region_id: null, ugel_id: null } : {}),
      onboarding_step: nextStep(profile.onboarding_step, 2),
    })
    .eq("user_id", userId)
    .select("user_id");
  if (error || !data?.length) return { error: error?.code === COHERENCE ? t.errorCoherence : es.cuenta.common.genericError };
  redirect("/bienvenida?paso=2");
}

export async function saveStep2Action(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, userId, profile } = await session();
  const skip = form.get("intent") === "skip";
  const parsed = onboardingStep2Schema.safeParse({
    regionId: form.get("regionId") ?? "",
    ugelId: form.get("ugelId") ?? "",
    institutionName: form.get("institutionName") ?? "",
    employmentStatus: form.get("employmentStatus") ?? "",
  });
  if (!skip && !parsed.success) return { error: t.errorCoherence };
  const fields = skip || !parsed.success ? {} : {
    region_id: parsed.data.regionId,
    ugel_id: parsed.data.regionId ? parsed.data.ugelId : null,
    institution_name: parsed.data.institutionName,
    employment_status: parsed.data.employmentStatus,
  };
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...fields, onboarding_step: nextStep(profile.onboarding_step, 3) })
    .eq("user_id", userId)
    .select("user_id");
  if (error || !data?.length) return { error: error?.code === COHERENCE ? t.errorCoherence : es.cuenta.common.genericError };
  redirect("/bienvenida?paso=3");
}

export async function saveStep3Action(_: FormState, form: FormData): Promise<FormState> {
  const parsed = onboardingStep3Schema.safeParse({
    levels: form.getAll("levels"),
    grades: form.getAll("grades"),
  });
  if (!parsed.success) return { error: t.errorStep3 };
  const { supabase } = await session();
  const { error } = await supabase.rpc("save_education_selection", {
    p_catalog_ids: [...parsed.data.levels, ...parsed.data.grades],
    p_complete: true,
  });
  if (error) return { error: error.code === COHERENCE ? t.errorCoherence : es.cuenta.common.genericError };
  redirect("/panel");
}
