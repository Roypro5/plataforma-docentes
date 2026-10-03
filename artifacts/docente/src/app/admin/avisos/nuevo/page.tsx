import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDenied } from "@/components/admin/denied";
import { AnnouncementForm } from "@/components/admin/avisos/announcement-form";
import { btnQuiet } from "@/components/cuenta/styles";
import { listActiveCountries } from "@/core/admin/avisos-queries";
import { requireAdmin } from "@/core/auth/viewer";
import { admin } from "@/i18n/es-admin";
import { adminAvisos } from "@/i18n/es-admin-avisos";

export const metadata = { title: "Nuevo aviso · Administración" };

const t = adminAvisos;

export default async function NuevoAvisoPage() {
  const { viewer, allowed } = await requireAdmin("admin.announcements.manage");
  if (!allowed) {
    return (
      <AdminShell viewer={viewer} section="avisos" title={t.newTitle} lead={admin.denied}>
        <AdminDenied />
      </AdminShell>
    );
  }
  const countries = await listActiveCountries();
  return (
    <AdminShell viewer={viewer} section="avisos" title={t.newTitle} lead={t.newLead}>
      <Link href="/admin/avisos" className={btnQuiet} data-testid="link-announcements-back">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t.backToList}
      </Link>
      <AnnouncementForm initial={{ id: null, title: "", body: "", startsAt: "", endsAt: "", countries: [], roles: [], plans: [] }} countries={countries} />
    </AdminShell>
  );
}
