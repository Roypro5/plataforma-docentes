import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/foundation/page-header";
import { Notice } from "@/components/cuenta/notice";
import { btnQuiet } from "@/components/cuenta/styles";
import { MarkAllRead } from "@/components/modulos/mark-read";
import { NotificationList } from "@/components/modulos/notification-list";
import { requireActiveViewer } from "@/core/auth/viewer";
import { countUnread, listNotifications } from "@/core/modules/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { es } from "@/i18n/es";

export const metadata = { title: "Notificaciones" };

const t = es.modulos.notificaciones;

// Page numbers come from the query string; anything that is not a positive integer is page 1.
function parsePage(value: string | undefined) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

export default async function Notificaciones({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const viewer = await requireActiveViewer();
  const supabase = (await createSupabaseServerClient())!;
  const page = parsePage((await searchParams).pagina);
  const [list, unread] = await Promise.all([listNotifications(supabase, page), countUnread(supabase)]);
  const href = (n: number) => (n <= 1 ? "/notificaciones" : `/notificaciones?pagina=${n}`);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={t.title} lead={t.lead} crumb={t.title} />

      <div className="rise d1 flex flex-wrap items-start justify-between gap-3">
        <p className="min-h-11 content-center text-sm font-medium text-muted-foreground" data-testid="text-unread-count">{t.unreadCount(unread ?? 0)}</p>
        <MarkAllRead disabled={!unread} />
      </div>

      {list.failed ? (
        <Notice testId="notice-notifications-error">{es.modulos.panel.loadError}</Notice>
      ) : list.items.length === 0 ? (
        <p className="paper rounded-2xl border p-5 text-sm text-muted-foreground" data-testid="text-notifications-empty">{t.empty}</p>
      ) : (
        <NotificationList items={list.items} displayName={viewer.profile?.display_name ?? null} withMarkRead headingLevel="h2" />
      )}

      {(page > 1 || list.hasNext) && (
        <nav aria-label={t.pagination} className="flex flex-wrap items-center justify-between gap-3">
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev" className={btnQuiet} data-testid="link-prev-page">
              <ChevronLeft className="h-4 w-4" aria-hidden />{t.previous}
            </Link>
          ) : <span />}
          <span className="text-sm text-muted-foreground" aria-current="page">{t.pageOf(page)}</span>
          {list.hasNext ? (
            <Link href={href(page + 1)} rel="next" className={btnQuiet} data-testid="link-next-page">
              {t.next}<ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
