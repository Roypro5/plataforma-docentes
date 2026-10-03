import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/foundation/page-header";
import { adminSections, type AdminSectionKey } from "@/core/admin/sections";
import { viewerCan, type SignedInViewer } from "@/core/auth/viewer";
import { admin } from "@/i18n/es-admin";

// Header and section menu shared by every /admin page. Links are filtered by permission only to
// avoid dead ends; each page and each database function checks the permission again.
export function AdminShell({
  viewer,
  section,
  title,
  lead,
  children,
}: {
  viewer: SignedInViewer;
  section: AdminSectionKey | null;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  const visible = adminSections.filter((s) => viewerCan(viewer, s.permission));
  const current = section ? admin.sections[section].label : admin.eyebrow;
  const links = visible.map((s) => {
    const active = s.key === section;
    return (
      <li key={s.key}>
        <Link
          href={s.href}
          aria-current={active ? "page" : undefined}
          className={`inline-flex min-h-11 w-full items-center rounded-xl px-3.5 text-sm font-medium sm:w-auto ${
            active ? "bg-primary text-primary-foreground" : "border hover:bg-muted"
          }`}
          data-testid={`link-admin-${s.key}`}
        >
          {admin.sections[s.key].label}
        </Link>
      </li>
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={admin.eyebrow} title={title} lead={lead} crumb={current} />
      {visible.length > 0 && (
        <nav aria-label={admin.navLabel}>
          <details className="group rounded-xl border sm:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3.5 text-sm font-medium">
              <span>
                {admin.navMobile}: {current}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ul className="space-y-1.5 border-t p-2">{links}</ul>
          </details>
          <ul className="hidden flex-wrap gap-2 sm:flex">{links}</ul>
        </nav>
      )}
      {children}
    </div>
  );
}
