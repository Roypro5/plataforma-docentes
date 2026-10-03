import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { can, type Permission } from "./permissions";

export type Profile = {
  display_name: string | null;
  country_code: string | null;
  region_id: string | null;
  ugel_id: string | null;
  employment_status: "nombrado" | "contratado" | "otro" | null;
  institution_name: string | null;
  onboarding_step: number;
  onboarding_completed_at: string | null;
};

export type SignedInViewer = {
  state: "signed-in";
  userId: string;
  email: string | null;
  aal: "aal1" | "aal2";
  status: "active" | "suspended" | "deletion_pending";
  profile: Profile | null;
  roles: string[];
};

export type Viewer = { state: "unconfigured" } | { state: "anonymous" } | SignedInViewer;

// One lookup per request. The JWT is verified by getClaims(); rows come through RLS, so
// a suspended account reads its own status but no profile or roles.
export const getViewer = cache(async (): Promise<Viewer> => {
  // Always render per request: these pages must never be prerendered, even when the
  // build runs without Supabase settings.
  await connection();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { state: "unconfigured" };
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { state: "anonymous" };

  const [user, profile, roles] = await Promise.all([
    supabase.from("users").select("status").eq("id", claims.sub).maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name, country_code, region_id, ugel_id, employment_status, institution_name, onboarding_step, onboarding_completed_at")
      .eq("user_id", claims.sub)
      .maybeSingle(),
    supabase.from("user_roles").select("role_code").eq("user_id", claims.sub),
  ]);

  return {
    state: "signed-in",
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
    // A missing row means the account was removed while the token is still valid.
    status: (user.data?.status as SignedInViewer["status"] | undefined) ?? "deletion_pending",
    profile: (profile.data as Profile | null) ?? null,
    roles: (roles.data ?? []).map((r) => r.role_code as string),
  };
});

// Page guard for signed-in areas: routes suspended or pending-deletion accounts to
// their status page and unfinished onboarding to /bienvenida.
export async function requireActiveViewer({ allowIncompleteOnboarding = false } = {}) {
  const viewer = await getViewer();
  if (viewer.state !== "signed-in") redirect("/ingresar");
  if (viewer.status !== "active") redirect("/cuenta-suspendida");
  if (!allowIncompleteOnboarding && !viewer.profile?.onboarding_completed_at) redirect("/bienvenida");
  return viewer;
}

export function viewerCan(viewer: SignedInViewer, permission: Permission) {
  return viewer.status === "active" && can(viewer.roles, permission);
}

// Administrative pages and Server Actions require the permission and an MFA (aal2)
// session; the database functions enforce the same rule independently.
export async function requireAdmin(permission: Permission = "admin.access") {
  const viewer = await requireActiveViewer({ allowIncompleteOnboarding: true });
  if (!viewerCan(viewer, permission)) return { viewer, allowed: false as const };
  if (viewer.aal !== "aal2") redirect("/admin/mfa");
  return { viewer, allowed: true as const };
}
