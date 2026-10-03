"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/cuenta/styles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { es } from "@/i18n/es";

const t = es.cuenta.eliminar;

// Deletion: request (recent re-authentication, blocks access) → perform (erases own data
// and the Auth identity in one transaction). If perform fails, the account stays
// blocked in deletion_pending and this same action retries it.
export async function deleteAccountAction(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: es.cuenta.common.genericError };
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/ingresar");

  const { data: user } = await supabase.from("users").select("status").eq("id", userId).maybeSingle();
  if (user && user.status !== "deletion_pending") {
    if (form.get("confirm") !== t.confirmWord) return { error: t.mismatch };
    const { error } = await supabase.rpc("request_account_deletion");
    if (error?.code === "23514") return { error: t.lastSuperadmin };
    if (error?.code === "42501") redirect("/ingresar?reauth=1&next=/perfil/eliminar");
    if (error) return { error: es.cuenta.common.genericError };
  }

  const { error } = await supabase.rpc("perform_account_deletion");
  if (error) redirect("/cuenta-suspendida");
  await supabase.auth.signOut({ scope: "local" });
  redirect("/ingresar?eliminada=1");
}
