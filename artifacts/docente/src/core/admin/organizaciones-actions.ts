"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/cuenta/styles";
import { adminCall } from "./rpc";
import { adminErrorMessage } from "./errors";
import { firstOrgError, ORG_NAME_MAX, orgCreateSchema, orgMemberAddSchema, orgMemberRemoveSchema, orgStatusSchema } from "./organizaciones-schemas";
import { adminOrgs } from "@/i18n/es-admin-organizaciones";

const PERMISSION = "admin.orgs.manage" as const;
const t = adminOrgs;

function formValue(form: FormData, name: string) {
  const v = form.get(name);
  return typeof v === "string" ? v : "";
}

function orgErrorText(key: ReturnType<typeof firstOrgError>) {
  return key === "name" ? t.errors.name(ORG_NAME_MAX) : t.errors[key];
}

export async function createTestOrgAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = orgCreateSchema.safeParse({ name: formValue(form, "name"), country: formValue(form, "country") });
  if (!parsed.success) return { error: orgErrorText(firstOrgError(parsed.error)) };
  const result = await adminCall<string>(PERMISSION, "admin_create_test_org", { p_name: parsed.data.name, p_country: parsed.data.country });
  if (!result.ok) return { error: adminErrorMessage(result.error, { invalid: t.errors.country }) };
  revalidatePath("/admin/organizaciones");
  if (typeof result.data === "string") redirect(`/admin/organizaciones/${result.data}?creada=1`);
  return { ok: t.create.created };
}

export async function setOrgStatusAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = orgStatusSchema.safeParse({ org: formValue(form, "org"), status: formValue(form, "status") });
  if (!parsed.success) return { error: t.errors.invalid };
  const result = await adminCall<unknown>(PERMISSION, "admin_set_org_status", { p_org: parsed.data.org, p_status: parsed.data.status });
  if (!result.ok) return { error: adminErrorMessage(result.error, { conflict: t.errors.notTest, notFound: t.errors.notFoundOrg }) };
  revalidatePath("/admin/organizaciones");
  revalidatePath(`/admin/organizaciones/${parsed.data.org}`);
  return { ok: parsed.data.status === "active" ? t.status.activated : t.status.deactivated };
}

export async function addOrgMemberAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = orgMemberAddSchema.safeParse({ org: formValue(form, "org"), email: formValue(form, "email"), role: formValue(form, "role") });
  if (!parsed.success) return { error: orgErrorText(firstOrgError(parsed.error)) };
  const { org, email, role } = parsed.data;
  const result = await adminCall<unknown>(PERMISSION, "admin_add_org_member", { p_org: org, p_email: email, p_role: role });
  if (!result.ok) {
    return {
      error: adminErrorMessage(result.error, {
        notFound: t.errors.addNotFound,
        conflict: t.errors.addConflict,
        duplicate: t.errors.addDuplicate,
        invalid: t.errors.role,
      }),
    };
  }
  revalidatePath(`/admin/organizaciones/${org}`);
  revalidatePath("/admin/organizaciones");
  return { ok: t.add.added };
}

export async function removeOrgMemberAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = orgMemberRemoveSchema.safeParse({ org: formValue(form, "org"), user: formValue(form, "user") });
  if (!parsed.success) return { error: t.errors.invalid };
  const { org, user } = parsed.data;
  const result = await adminCall<unknown>(PERMISSION, "admin_remove_org_member", { p_org: org, p_user: user });
  if (!result.ok) {
    return { error: adminErrorMessage(result.error, { notFound: t.errors.removeNotFound, conflict: t.errors.removeConflict }) };
  }
  revalidatePath(`/admin/organizaciones/${org}`);
  revalidatePath("/admin/organizaciones");
  return { ok: t.remove.removed };
}
