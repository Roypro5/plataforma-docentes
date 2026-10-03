"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Check, CheckCheck } from "lucide-react";
import { FormMessage } from "@/components/cuenta/form-ui";
import { btnQuiet } from "@/components/cuenta/styles";
import { markAllNotificationsReadFormAction, markOneNotificationReadFormAction } from "@/core/modules/actions";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/components/modulos/notification-events";
import { es } from "@/i18n/es";

const t = es.modulos.notificaciones;

function Submit({ label, testId, small = false, children }: { label: string; testId: string; small?: boolean; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-label={label} className={`${btnQuiet} ${small ? "w-full sm:w-auto" : ""}`} data-testid={testId}>
      {children}
    </button>
  );
}

// Tell the shell bell to refresh its unread count once a mark-as-read action succeeded.
function useNotifyBell(ok: string | undefined) {
  useEffect(() => {
    if (ok) window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }, [ok]);
}

export function MarkAllRead({ disabled }: { disabled: boolean }) {
  const [state, action] = useActionState(markAllNotificationsReadFormAction, undefined);
  useNotifyBell(state?.ok);
  return (
    <form action={action} className="space-y-3">
      <button
        type="submit"
        disabled={disabled}
        className={btnQuiet}
        data-testid="button-mark-all-read"
      >
        <CheckCheck className="h-4 w-4 shrink-0" aria-hidden />
        {t.markAll}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

// Stays mounted after the item turns read so the confirmation keeps its live region.
export function MarkOneRead({ id, title, unread }: { id: string; title: string; unread: boolean }) {
  const [state, action] = useActionState(markOneNotificationReadFormAction, undefined);
  useNotifyBell(state?.ok);
  return (
    <form action={action} className="space-y-2">
      {unread && (
        <>
          <input type="hidden" name="id" value={id} />
          <Submit label={`${t.markOne}: ${title}`} testId="button-mark-read" small>
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            {t.markOne}
          </Submit>
        </>
      )}
      <FormMessage state={state} />
    </form>
  );
}
