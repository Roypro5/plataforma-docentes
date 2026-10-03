import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { AdminDenied } from "@/components/admin/denied";
import { AnnouncementForm } from "@/components/admin/avisos/announcement-form";
import { AnnouncementPreview } from "@/components/admin/avisos/announcement-preview";
import { audienceText, whenText } from "@/components/admin/avisos/audience";
import { AnnouncementStatusBadge } from "@/components/admin/avisos/status-badge";
import { FormMessage } from "@/components/cuenta/form-ui";
import { Notice } from "@/components/cuenta/notice";
import { btnPrimary, btnQuiet } from "@/components/cuenta/styles";
import { publishAnnouncementAction, unpublishAnnouncementAction } from "@/core/admin/avisos-actions";
import { isoToLimaInput } from "@/core/admin/avisos-dates";
import { getAnnouncement, listActiveCountries } from "@/core/admin/avisos-queries";
import { announcementIdSchema } from "@/core/admin/avisos-schemas";
import { requireAdmin } from "@/core/auth/viewer";
import { admin } from "@/i18n/es-admin";
import { adminAvisos } from "@/i18n/es-admin-avisos";

export const metadata = { title: "Aviso · Administración" };

const t = adminAvisos;

export default async function AvisoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { viewer, allowed } = await requireAdmin("admin.announcements.manage");
  if (!allowed) {
    return (
      <AdminShell viewer={viewer} section="avisos" title={t.editTitle} lead={admin.denied}>
        <AdminDenied />
      </AdminShell>
    );
  }

  const parsed = announcementIdSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const id = parsed.data.id;
  const justCreated = (await searchParams).creado === "1";

  const [{ item, notFound: missing, failed }, countries] = await Promise.all([getAnnouncement(id), listActiveCountries()]);
  if (missing) notFound();

  const back = (
    <Link href="/admin/avisos" className={btnQuiet} data-testid="link-announcements-back">
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {t.backToList}
    </Link>
  );

  if (failed || !item) {
    return (
      <AdminShell viewer={viewer} section="avisos" title={t.editTitle} lead={t.editLead}>
        {back}
        <Notice testId="notice-announcement-error">{admin.common.loadError}</Notice>
      </AdminShell>
    );
  }

  const countryNames = Object.fromEntries(countries.map((c) => [c.code, c.name]));
  const published = item.status === "published";

  return (
    <AdminShell viewer={viewer} section="avisos" title={t.editTitle} lead={published ? t.publishedLead : t.editLead}>
      {back}
      <div className="flex flex-wrap items-center gap-3">
        <AnnouncementStatusBadge status={item.status} />
        {justCreated && !published && <FormMessage state={{ ok: t.created }} />}
      </div>

      {published ? (
        <AnnouncementPreview
          title={item.title}
          body={item.body}
          when={whenText(item.starts_at, item.ends_at)}
          audience={audienceText(item.country_codes, item.role_codes, item.plan_codes, countryNames)}
        />
      ) : (
        <AnnouncementForm
          initial={{
            id: item.id,
            title: item.title,
            body: item.body,
            startsAt: isoToLimaInput(item.starts_at),
            endsAt: isoToLimaInput(item.ends_at),
            countries: item.country_codes,
            roles: item.role_codes,
            plans: item.plan_codes,
          }}
          countries={countries}
        />
      )}

      <section aria-labelledby="announcement-publication-title" className="paper space-y-3 rounded-2xl border p-5 sm:p-6" data-testid="section-announcement-publication">
        <h2 id="announcement-publication-title" className="font-display text-lg font-semibold">
          {t.publish.title}
        </h2>
        {published ? (
          <>
            <p className="text-sm font-medium" data-testid="text-announcement-unpublish-to-edit">
              {t.publish.publishedNote}
            </p>
            <p className="text-sm text-muted-foreground">{t.publish.publishedHelp}</p>
            <ConfirmForm
              action={unpublishAnnouncementAction}
              fields={{ id: item.id }}
              label={t.publish.unpublish}
              confirmTitle={t.publish.unpublishConfirmTitle}
              confirmBody={t.publish.unpublishConfirmBody}
              confirmLabel={t.publish.unpublishConfirmLabel}
              testId="button-announcement-unpublish"
            />
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t.publish.draftNote}</p>
            <ConfirmForm
              action={publishAnnouncementAction}
              fields={{ id: item.id }}
              label={t.publish.publish}
              confirmTitle={t.publish.publishConfirmTitle}
              confirmBody={t.publish.publishConfirmBody}
              confirmLabel={t.publish.publishConfirmLabel}
              className={btnPrimary}
              testId="button-announcement-publish"
            />
          </>
        )}
      </section>
    </AdminShell>
  );
}
