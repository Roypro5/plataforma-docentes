import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminCall, type AdminResult } from "./rpc";
import type { Country, ModuleRow } from "./modulos-schemas";

/** `admin_list_modules` (permiso `admin.modules.manage`); the demo module is excluded in SQL. */
export async function listModules(): Promise<AdminResult<ModuleRow[]>> {
  const res = await adminCall<ModuleRow[] | null>("admin.modules.manage", "admin_list_modules");
  return res.ok ? { ok: true, data: res.data ?? [] } : res;
}

/** Active countries from the `countries` table (public reference data). `null` when the read fails. */
export async function listActiveCountries(): Promise<Country[] | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from("countries").select("code, name").eq("active", true).order("name");
  if (error) return null;
  return (data ?? []) as Country[];
}
