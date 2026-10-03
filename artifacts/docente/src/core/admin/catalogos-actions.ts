"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/cuenta/styles";
import { adminCall } from "./rpc";
import { adminErrorMessage } from "./errors";
import { catalogActiveSchema, catalogNameMax, catalogRenameSchema, isCatalogKind } from "./catalogos-schemas";
import { adminCatalogos } from "@/i18n/es-admin-catalogos";

const PERMISSION = "admin.catalogs.manage" as const;
const t = adminCatalogos;

export async function renameCatalogItemAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = catalogRenameSchema.safeParse({ kind: form.get("kind"), id: form.get("id"), name: form.get("name") ?? "" });
  if (!parsed.success) {
    const kind = form.get("kind");
    const nameIssue = parsed.error.issues.some((i) => i.path[0] === "name");
    return { error: nameIssue && isCatalogKind(kind) ? t.errors.name(catalogNameMax(kind)) : t.errors.invalid };
  }
  const { kind, id, name } = parsed.data;
  const result = await adminCall<unknown>(PERMISSION, "admin_rename_catalog_item", { p_kind: kind, p_id: id, p_name: name });
  if (!result.ok) return { error: adminErrorMessage(result.error, { invalid: t.errors.name(catalogNameMax(kind)) }) };
  revalidatePath("/admin/catalogos");
  return { ok: t.rename.saved };
}

export async function setCatalogItemActiveAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = catalogActiveSchema.safeParse({ kind: form.get("kind"), id: form.get("id"), active: form.get("active") });
  if (!parsed.success) return { error: t.errors.invalid };
  const { kind, id, active } = parsed.data;
  const result = await adminCall<unknown>(PERMISSION, "admin_set_catalog_item_active", { p_kind: kind, p_id: id, p_active: active });
  if (!result.ok) return { error: adminErrorMessage(result.error) };
  revalidatePath("/admin/catalogos");
  return { ok: active ? t.status.activated : t.status.deactivated };
}
