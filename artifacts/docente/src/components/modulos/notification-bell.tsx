"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { getUnreadCountAction } from "@/core/modules/actions";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/components/modulos/notification-events";
import { es } from "@/i18n/es";

const t = es.modulos.notificaciones;

// Bell with the unread count, for the shell. The shell is rendered on public pages too, so the
// count is not part of the HTML: it is requested with a Server Action when the path changes and
// after a mark-as-read. Without a session or without Supabase the action answers null and the
// bell is not rendered, so public pages stay static and never show a fake count.
export function NotificationBell({ className = "" }: { className?: string }) {
  const path = usePathname();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      getUnreadCountAction()
        .then((value) => {
          if (!cancelled) setCount(value);
        })
        .catch(() => {
          if (!cancelled) setCount(null);
        });
    };
    refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [path]);

  if (count === null) return null;
  return (
    <Link
      href="/notificaciones"
      aria-label={t.bellLabel(count)}
      title={t.bellLabel(count)}
      data-testid="link-bell"
      className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full border text-foreground hover:bg-muted ${className}`}
    >
      <Bell className="h-5 w-5" aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          data-testid="text-bell-count"
          className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold leading-none text-accent-foreground"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
