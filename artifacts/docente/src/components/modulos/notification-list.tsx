import Link from "next/link";
import { MarkOneRead } from "@/components/modulos/mark-read";
import { notificationContent, type NotificationRow } from "@/core/modules/notification-text";
import { es } from "@/i18n/es";

const t = es.modulos.notificaciones;
const dateTime = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" });

// Notifications rendered as plain text. Unread ones get a marker, a stronger border and the
// text "Sin leer", so state never depends on color alone.
export function NotificationList({ items, displayName, withMarkRead = false, headingLevel = "h3" }: {
  items: NotificationRow[]; displayName: string | null; withMarkRead?: boolean; headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <ul className="space-y-3" aria-label={es.modulos.panel.notificationsList} data-testid="list-notifications">
      {items.map((n) => {
        const unread = n.read_at === null;
        const content = notificationContent(n, displayName);
        return (
          <li
            key={n.id}
            className={`rounded-2xl border p-4 ${unread ? "border-primary bg-primary-soft" : "bg-surface"}`}
            data-testid={`item-notification-${unread ? "unread" : "read"}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${unread ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {unread ? t.unread : t.read}
              </span>
              <time dateTime={n.created_at} className="text-xs text-muted-foreground">{dateTime.format(new Date(n.created_at))}</time>
            </div>
            <Heading className={`mt-2 break-words text-base leading-snug ${unread ? "font-semibold" : "font-medium"}`}>{content.title}</Heading>
            <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">{content.body}</p>
            <div className="mt-3 flex flex-wrap items-start gap-3">
              <Link href={content.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4" data-testid="link-notification">
                {t.open}
              </Link>
              {withMarkRead && <MarkOneRead id={n.id} title={content.title} unread={unread} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
