import { ConfirmForm } from "@/components/admin/confirm-form";
import { formatLima } from "@/core/admin/avisos-dates";
import { removeOrgMemberAction } from "@/core/admin/organizaciones-actions";
import type { OrgMember } from "@/core/admin/organizaciones-queries";
import { adminOrgs } from "@/i18n/es-admin-organizaciones";

const t = adminOrgs.members;
const r = adminOrgs.remove;

// Cards instead of a table: they fit 360 px without horizontal scrolling.
export function MemberList({ orgId, members, canRemove }: { orgId: string; members: OrgMember[]; canRemove: boolean }) {
  return (
    <ul className="space-y-3" aria-label={t.label} data-testid="list-org-members">
      {members.map((m) => {
        const active = m.status === "active";
        const who = m.display_name || m.email || t.noName;
        return (
          <li key={m.user_id} className="rounded-xl border p-4" data-testid={`row-member-${m.user_id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="break-words font-semibold">{m.display_name || t.noName}</p>
                <p className="break-all text-sm text-muted-foreground">
                  {t.email}: {m.email ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t.role}: {t.roles[m.role_code as keyof typeof t.roles] ?? m.role_code} · {t.since} {formatLima(m.created_at)}
                  {m.removed_at && ` · ${t.removedAt} ${formatLima(m.removed_at)}`}
                </p>
                <span
                  className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${active ? "border-transparent bg-primary-soft text-primary" : "bg-muted text-foreground"}`}
                >
                  {active ? t.state.active : t.state.removed}
                </span>
              </div>
              {active && canRemove && (
                <ConfirmForm
                  action={removeOrgMemberAction}
                  fields={{ org: orgId, user: m.user_id }}
                  label={
                    <>
                      {r.button}
                      <span className="sr-only">: {who}</span>
                    </>
                  }
                  confirmTitle={r.confirmTitle(who)}
                  confirmBody={r.confirmBody}
                  confirmLabel={r.confirmLabel}
                  testId={`button-member-remove-${m.user_id}`}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
