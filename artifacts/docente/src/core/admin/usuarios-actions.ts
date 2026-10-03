"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/cuenta/styles";
import { requireAdmin, viewerCan } from "@/core/auth/viewer";
import { adminErrorMessage } from "./errors";
import { adminCall } from "./rpc";
import { isPrivilegedRole, roleChangeSchema, setStatusSchema } from "./usuarios-schemas";
import { admin } from "@/i18n/es-admin";
import { adminUsuarios } from "@/i18n/es-admin-usuarios";

const t = adminUsuarios;

// Each action checks the permission again (adminCall) and the database repeats every rule, so a
// hidden button is never what protects anything.

export async function setUserStatusAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = setStatusSchema.safeParse({ userId: form.get("userId"), status: form.get("status") });
  if (!parsed.success) return { error: admin.errors.invalid };
  const { viewer } = await requireAdmin("admin.users.suspend");
  if (parsed.data.userId === viewer.userId) return { error: t.errors.own };
  const res = await adminCall("admin.users.suspend", "admin_set_user_status", {
    p_user: parsed.data.userId,
    p_status: parsed.data.status,
  });
  if (!res.ok) return { error: adminErrorMessage(res.error, { notFound: t.errors.statusNotFound, conflict: t.errors.lastSuperadmin }) };
  revalidatePath("/admin/usuarios");
  return { ok: parsed.data.status === "suspended" ? t.results.suspended : t.results.reactivated };
}

async function changeRole(rpc: "admin_grant_role" | "admin_revoke_role", form: FormData): Promise<FormState & { role?: string }> {
  const parsed = roleChangeSchema.safeParse({ userId: form.get("userId"), role: form.get("role") });
  if (!parsed.success) return { error: admin.errors.invalid };
  const { viewer } = await requireAdmin("admin.roles.grant");
  if (parsed.data.userId === viewer.userId) return { error: t.errors.own };
  if (isPrivilegedRole(parsed.data.role) && !viewerCan(viewer, "admin.roles.grant_privileged")) {
    return { error: t.errors.privileged };
  }
  const res = await adminCall("admin.roles.grant", rpc, { p_user: parsed.data.userId, p_role: parsed.data.role });
  if (!res.ok) return { error: adminErrorMessage(res.error, { notFound: t.errors.grantNotFound, conflict: t.errors.lastSuperadmin }) };
  revalidatePath("/admin/usuarios");
  return { role: parsed.data.role };
}

export async function grantRoleAction(_: FormState, form: FormData): Promise<FormState> {
  const res = await changeRole("admin_grant_role", form);
  if (res.error || !res.role) return { error: res.error };
  return { ok: t.results.granted(t.roles[res.role as keyof typeof t.roles]) };
}

export async function revokeRoleAction(_: FormState, form: FormData): Promise<FormState> {
  const res = await changeRole("admin_revoke_role", form);
  if (res.error || !res.role) return { error: res.error };
  return { ok: t.results.revoked(t.roles[res.role as keyof typeof t.roles]) };
}
