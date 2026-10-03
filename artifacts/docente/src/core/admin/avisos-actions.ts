"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/cuenta/styles";
import { adminCall } from "./rpc";
import { adminErrorMessage } from "./errors";
import { adminAvisos } from "@/i18n/es-admin-avisos";
import { announcementFormToInput, announcementIdSchema, announcementSaveSchema, firstAnnouncementError } from "./avisos-schemas";

const PERMISSION = "admin.announcements.manage" as const;
const t = adminAvisos;

function revalidate(id: string) {
  revalidatePath("/admin/avisos");
  revalidatePath(`/admin/avisos/${id}`);
}

/** Creates a draft (no id) or edits one (draft only; the database refuses a published one). */
export async function saveAnnouncementAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = announcementSaveSchema.safeParse(announcementFormToInput(form));
  if (!parsed.success) return { error: t.errors[firstAnnouncementError(parsed.error)] };
  const v = parsed.data;

  const result = await adminCall<string>(PERMISSION, "admin_save_announcement", {
    p_id: v.id,
    p_title: v.title,
    p_body: v.body,
    p_starts_at: v.startsAt,
    p_ends_at: v.endsAt,
    p_country_codes: v.countries,
    p_role_codes: v.roles,
    p_plan_codes: v.plans,
  });
  if (!result.ok) {
    return { error: adminErrorMessage(result.error, { conflict: t.errors.savePublished, notFound: t.errors.saveNotFound }) };
  }

  const id = typeof result.data === "string" ? result.data : v.id;
  if (id) revalidate(id);
  else revalidatePath("/admin/avisos");
  if (!v.id && id) redirect(`/admin/avisos/${id}?creado=1`);
  return { ok: t.saved };
}

async function changePublication(form: FormData, fn: "admin_publish_announcement" | "admin_unpublish_announcement"): Promise<FormState> {
  const parsed = announcementIdSchema.safeParse({ id: form.get("id") });
  if (!parsed.success) return { error: t.errors.id };
  const publishing = fn === "admin_publish_announcement";
  const result = await adminCall<unknown>(PERMISSION, fn, { p_id: parsed.data.id });
  if (!result.ok) {
    return {
      error: adminErrorMessage(result.error, {
        conflict: publishing ? t.errors.publishConflict : t.errors.unpublishConflict,
        notFound: t.errors.saveNotFound,
      }),
    };
  }
  revalidate(parsed.data.id);
  return { ok: publishing ? t.publish.published : t.publish.unpublished };
}

export async function publishAnnouncementAction(_: FormState, form: FormData): Promise<FormState> {
  return changePublication(form, "admin_publish_announcement");
}

export async function unpublishAnnouncementAction(_: FormState, form: FormData): Promise<FormState> {
  return changePublication(form, "admin_unpublish_announcement");
}
