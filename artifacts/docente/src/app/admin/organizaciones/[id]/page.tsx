import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDenied } from "@/components/admin/denied";
import { AddMemberForm } from "@/components/admin/organizaciones/add-member-form";
import { MemberList } from "@/components/admin/organizaciones/member-list";
import { OrgStatusForm, OrgStatusTag } from "@/components/admin/organizaciones/org-list";
import { FormMessage } from "@/components/cuenta/form-ui";
import { Notice } from "@/components/cuenta/notice";
import { btnQuiet } from "@/components/cuenta/styles";
import { Section } from "@/components/foundation/page-header";
import { findOrg, listOrgMembers } from "@/core/admin/organizaciones-queries";
import { z } from "zod";
import { requireAdmin } from "@/core/auth/viewer";
import { admin } from "@/i18n/es-admin";
import { adminOrgs } from "@/i18n/es-admin-organizaciones";

export const metadata = { title: "Miembros de la organización · Administración" };

const t = adminOrgs;

export default async function OrganizacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { viewer, allowed } = await requireAdmin("admin.orgs.manage");
  if (!allowed) {
    return (
      <AdminShell viewer={viewer} section="organizaciones" title={t.detailTitleFallback} lead={admin.denied}>
        <AdminDenied />
      </AdminShell>
    );
  }

  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const id = parsed.data;
  const justCreated = (await searchParams).creada === "1";

  const [org, listing] = await Promise.all([findOrg(id), listOrgMembers(id)]);
  if (listing.notFound) notFound();

  const title = org?.name ?? t.detailTitleFallback;
  // Members can be added only to an active test organization (the database checks it again).
  const canManage = org === null ? true : org.is_test;
  const canAdd = org === null ? true : org.is_test && org.status === "active";

  return (
    <AdminShell viewer={viewer} section="organizaciones" title={title} lead={t.detailLead}>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/organizaciones" className={btnQuiet} data-testid="link-orgs-back">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t.backToList}
        </Link>
        {org && <OrgStatusTag status={org.status} />}
        {justCreated && <FormMessage state={{ ok: t.create.created }} />}
      </div>

      {org && org.is_test && (
        <div>
          <OrgStatusForm id={org.id} name={org.name} status={org.status} />
        </div>
      )}
      {org && !org.is_test && <Notice testId="notice-org-not-test">{t.list.notTestNote}</Notice>}

      <Section title={t.add.title}>
        <p className="mb-4 text-sm text-muted-foreground" data-testid="text-org-no-invites">
          {t.add.note}
        </p>
        {canAdd ? <AddMemberForm orgId={id} /> : <p className="text-sm font-medium">{t.add.inactiveOrg}</p>}
      </Section>

      <Section title={t.members.title}>
        {listing.failed ? (
          <Notice testId="notice-members-error">{t.members.loadError}</Notice>
        ) : listing.members.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-members-empty">
            {t.members.empty}
          </p>
        ) : (
          <>
            <MemberList orgId={id} members={listing.members} canRemove={canManage} />
            {listing.members.length >= 200 && <p className="mt-3 text-sm text-muted-foreground">{t.members.limit}</p>}
          </>
        )}
      </Section>
    </AdminShell>
  );
}
