"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/cuenta/styles";
import { admin } from "@/i18n/es-admin";
import { adminModulos } from "@/i18n/es-admin-modulos";
import { adminErrorMessage } from "./errors";
import { moduleCountrySchema, moduleEmergencySchema, moduleStatusSchema } from "./modulos-schemas";
import { adminCall } from "./rpc";

const t = adminModulos;
const PERMISSION = "admin.modules.manage";

// Every action calls adminCall again with its permission; the database also forbids the demo
// module and activating a module without implementation.

function revalidate() {
  revalidatePath("/admin/modulos");
  // Teachers see the result in their panel.
  revalidatePath("/panel");
}

export async function setModuleStatusAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = moduleStatusSchema.safeParse({ module: form.get("module"), status: form.get("status") });
  if (!parsed.success) return { error: admin.errors.invalid };
  const res = await adminCall(PERMISSION, "admin_set_module_status", { p_module: parsed.data.module, p_status: parsed.data.status });
  if (!res.ok) return { error: adminErrorMessage(res.error, { conflict: t.errors.notImplemented, notFound: t.errors.notFound }) };
  revalidate();
  return { ok: t.results.status };
}

export async function setModuleEmergencyAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = moduleEmergencySchema.safeParse({ module: form.get("module"), disabled: form.get("disabled") });
  if (!parsed.success) return { error: admin.errors.invalid };
  const res = await adminCall(PERMISSION, "admin_set_module_emergency", { p_module: parsed.data.module, p_disabled: parsed.data.disabled });
  if (!res.ok) return { error: adminErrorMessage(res.error, { notFound: t.errors.notFound }) };
  revalidate();
  return { ok: parsed.data.disabled ? t.results.emergencyOn : t.results.emergencyOff };
}

export async function setModuleCountryAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = moduleCountrySchema.safeParse({ module: form.get("module"), country: form.get("country"), enabled: form.get("enabled") });
  if (!parsed.success) return { error: admin.errors.invalid };
  const res = await adminCall(PERMISSION, "admin_set_module_country", {
    p_module: parsed.data.module,
    p_country: parsed.data.country,
    p_enabled: parsed.data.enabled,
  });
  if (!res.ok) return { error: adminErrorMessage(res.error, { invalid: t.errors.countryInvalid, notFound: t.errors.notFound, conflict: t.errors.countryEntitled }) };
  revalidate();
  return { ok: parsed.data.enabled ? t.results.countryOn : t.results.countryOff };
}
