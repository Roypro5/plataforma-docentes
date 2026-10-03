import Link from "next/link";
import { ArrowRight, UserRound } from "lucide-react";
import { PageHeader, Section } from "@/components/foundation/page-header";
import { Notice } from "@/components/cuenta/notice";
import { btnQuiet } from "@/components/cuenta/styles";
import { ModuleCard } from "@/components/modulos/module-card";
import { NotificationList } from "@/components/modulos/notification-list";
import { requireActiveViewer } from "@/core/auth/viewer";
import { listMyModules, listNotifications, listVisibleAnnouncements, countUnread } from "@/core/modules/queries";
import { loadProfileContext } from "@/core/profile/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { es } from "@/i18n/es";

export const metadata = { title: "Panel" };

const t = es.modulos.panel;
const longDate = new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeZone: "America/Lima" });
const PREVIEW_NOTIFICATIONS = 3;

export default async function Panel() {
  const viewer = await requireActiveViewer();
  const supabase = (await createSupabaseServerClient())!;
  const profile = viewer.profile!;
  const [context, modules, announcements, notifications, unread] = await Promise.all([
    loadProfileContext(supabase, profile.country_code),
    listMyModules(supabase),
    listVisibleAnnouncements(supabase),
    listNotifications(supabase, 1, PREVIEW_NOTIFICATIONS),
    countUnread(supabase),
  ]);

  const chosen = context.catalog.filter((item) => context.selected.includes(item.id));
  const levels = chosen.filter((item) => item.kind === "level").map((item) => item.name);
  const grades = chosen.filter((item) => item.kind === "grade").map((item) => item.name);
  const name = profile.display_name?.trim();

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={name ? t.greeting(name) : t.greetingAnonymous} lead={t.lead} crumb={t.title} />

      <section aria-label={es.nav.cuenta.label} className="paper rise d1 flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" data-testid="section-profile-summary">
        <div className="min-w-0 space-y-1 text-sm">
          {levels.length === 0 && grades.length === 0 ? (
            <p className="text-muted-foreground">{t.noLevels}</p>
          ) : (
            <>
              {levels.length > 0 && <p className="break-words" data-testid="text-levels">{t.levels(levels.join(", "))}</p>}
              {grades.length > 0 && <p className="break-words" data-testid="text-grades">{t.grades(grades.join(", "))}</p>}
            </>
          )}
        </div>
        <Link href="/perfil" className={`${btnQuiet} w-full shrink-0 sm:w-auto`} data-testid="link-profile">
          <UserRound className="h-4 w-4" aria-hidden />
          {t.profileLink}
        </Link>
      </section>

      <Section title={t.modulesTitle}>
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">{t.modulesLead}</p>
        {modules.failed ? (
          <Notice testId="notice-modules-error">{t.loadError}</Notice>
        ) : modules.modules.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-modules-empty">{t.modulesEmpty}</p>
        ) : (
          <ul aria-label={t.modulesList} className="grid gap-4 sm:grid-cols-2" data-testid="list-modules">
            {modules.modules.map((entry) => <ModuleCard key={entry.id} entry={entry} />)}
          </ul>
        )}
        {modules.modules.some((m) => m.access === "coming_soon") && (
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{es.modulos.notify.note}</p>
        )}
      </Section>

      <Section title={t.announcementsTitle}>
        {announcements.failed ? (
          <Notice testId="notice-announcements-error">{t.loadError}</Notice>
        ) : announcements.items.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-announcements-empty">{t.announcementsEmpty}</p>
        ) : (
          <ul aria-label={t.announcementsList} className="space-y-4" data-testid="list-announcements">
            {announcements.items.map((a) => (
              <li key={a.id} className="rounded-xl border bg-surface p-4">
                {/* Plain text only: React escapes it and line breaks are kept with CSS. */}
                <h3 className="break-words text-base font-semibold leading-snug">{a.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{t.announcementFrom(longDate.format(new Date(a.starts_at)))}</p>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={t.notificationsTitle}
        aside={unread ? <span className="text-sm font-medium text-primary" data-testid="text-unread">{es.modulos.notificaciones.unreadCount(unread)}</span> : undefined}
      >
        {notifications.failed ? (
          <Notice testId="notice-notifications-error">{t.loadError}</Notice>
        ) : notifications.items.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-notifications-empty">{t.notificationsEmpty}</p>
        ) : (
          <NotificationList items={notifications.items} displayName={profile.display_name} />
        )}
        <Link href="/notificaciones" className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary underline underline-offset-4" data-testid="link-notifications">
          {t.notificationsAll}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Section>
    </div>
  );
}
