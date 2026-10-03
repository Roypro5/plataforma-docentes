import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/foundation/page-header";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDenied } from "@/components/admin/denied";
import { adminSections } from "@/core/admin/sections";
import { requireAdmin, viewerCan } from "@/core/auth/viewer";
import { admin } from "@/i18n/es-admin";

export const metadata = { title: "Administración" };

export default async function Admin() {
  const { viewer, allowed } = await requireAdmin();
  if (!allowed) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow={admin.eyebrow} title={admin.title} lead={admin.denied} crumb={admin.eyebrow} />
        <AdminDenied />
      </div>
    );
  }
  const visible = adminSections.filter((s) => viewerCan(viewer, s.permission));
  return (
    <AdminShell viewer={viewer} section={null} title={admin.title} lead={admin.lead}>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className="paper flex min-h-20 items-center justify-between gap-3 rounded-2xl border p-4 hover:bg-muted"
              data-testid={`card-admin-${s.key}`}
            >
              <span>
                <span className="block font-semibold">{admin.sections[s.key].label}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{admin.sections[s.key].desc}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
