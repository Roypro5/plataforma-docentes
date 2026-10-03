import Link from "next/link";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { btnDanger, btnQuiet, fieldClass } from "@/components/cuenta/styles";
import { grantRoleAction, revokeRoleAction, setUserStatusAction } from "@/core/admin/usuarios-actions";
import { auditLinkForUser, formatLimaDate, rowActions, type ActionContext, type UserRow, type UserStatus } from "@/core/admin/usuarios-schemas";
import { adminUsuarios } from "@/i18n/es-admin-usuarios";

const t = adminUsuarios;

const statusStyle: Record<UserStatus, string> = {
  active: "bg-primary-soft text-primary",
  suspended: "bg-danger-soft text-danger",
  deletion_pending: "bg-accent-soft text-foreground",
};

function roleLabel(code: string): string {
  return (t.roles as Record<string, string>)[code] ?? code;
}

// Visible text plus a longer name for screen readers, so repeated buttons say whom they affect.
function ButtonLabel({ visible, full }: { visible: string; full: string }) {
  return (
    <>
      <span aria-hidden>{visible}</span>
      <span className="sr-only">{full}</span>
    </>
  );
}

/** One user as a card: readable at 360 px and on desktop. Personal data is plain text only. */
function UserCard({ row, ctx, showAudit }: { row: UserRow; ctx: ActionContext; showAudit: boolean }) {
  const who = row.email ?? row.display_name ?? row.user_id;
  const actions = rowActions(row, ctx);
  const held = row.roles ?? [];
  const hasActions = actions.suspend || actions.reactivate || actions.grantable.length > 0 || actions.revocable.length > 0;

  return (
    <li className="paper rounded-2xl border p-4 sm:p-5" data-testid={`row-user-${row.user_id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 break-all font-semibold" data-testid={`text-user-email-${row.user_id}`}>
          {row.email ?? t.list.noEmail}
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[row.status] ?? "bg-muted"}`}
          data-testid={`text-user-status-${row.user_id}`}
        >
          {t.status[row.status] ?? row.status}
        </span>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0">
          <dt className="text-muted-foreground">{t.list.name}</dt>
          <dd className="break-words">{row.display_name || t.list.noName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.list.country}</dt>
          <dd>{row.country_code || t.list.noCountry}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.list.createdAt}</dt>
          <dd>{formatLimaDate(row.created_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.list.roles}</dt>
          <dd data-testid={`text-user-roles-${row.user_id}`}>{held.length > 0 ? held.map(roleLabel).join(", ") : t.list.noRoles}</dd>
        </div>
      </dl>

      <div className="mt-4 space-y-3 border-t pt-4">
        {actions.own && <p className="text-sm text-muted-foreground">{t.actions.own}</p>}
        {!actions.own && !hasActions && <p className="text-sm text-muted-foreground">{t.actions.none}</p>}

        {hasActions && (
          <div className="flex flex-wrap items-start gap-3">
            {actions.suspend && (
              <ConfirmForm
                action={setUserStatusAction}
                fields={{ userId: row.user_id, status: "suspended" }}
                label={<ButtonLabel visible={t.actions.suspend} full={t.actions.suspendFor(who)} />}
                confirmTitle={t.actions.suspendTitle}
                confirmBody={t.actions.suspendBody}
                confirmLabel={t.actions.suspendConfirm}
                className={btnDanger}
                testId={`button-user-suspend-${row.user_id}`}
              />
            )}
            {actions.reactivate && (
              <ConfirmForm
                action={setUserStatusAction}
                fields={{ userId: row.user_id, status: "active" }}
                label={<ButtonLabel visible={t.actions.reactivate} full={t.actions.reactivateFor(who)} />}
                testId={`button-user-reactivate-${row.user_id}`}
              />
            )}
            {actions.grantable.length > 0 && (
              <ConfirmForm
                action={grantRoleAction}
                fields={{ userId: row.user_id }}
                label={<ButtonLabel visible={t.actions.grant} full={t.actions.grantFor(who)} />}
                testId={`button-user-grant-${row.user_id}`}
              >
                <label htmlFor={`grant-role-${row.user_id}`} className="sr-only">
                  {t.actions.grantLabel(who)}
                </label>
                <select
                  id={`grant-role-${row.user_id}`}
                  name="role"
                  defaultValue={actions.grantable[0]}
                  className={`${fieldClass} mt-0`}
                  data-testid={`select-user-grant-${row.user_id}`}
                >
                  {actions.grantable.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </ConfirmForm>
            )}
            {actions.revocable.map((r) => (
              <ConfirmForm
                key={r}
                action={revokeRoleAction}
                fields={{ userId: row.user_id, role: r }}
                label={<ButtonLabel visible={t.actions.revoke(roleLabel(r))} full={t.actions.revokeFor(roleLabel(r), who)} />}
                confirmTitle={t.actions.revokeTitle(roleLabel(r))}
                confirmBody={t.actions.revokeBody}
                confirmLabel={t.actions.revokeConfirm}
                className={btnQuiet}
                testId={`button-user-revoke-${r}-${row.user_id}`}
              />
            ))}
          </div>
        )}

        {showAudit && (
          <Link href={auditLinkForUser(row.user_id)} className={btnQuiet} data-testid={`link-user-audit-${row.user_id}`}>
            <ButtonLabel visible={t.list.audit} full={t.list.auditFor(who)} />
          </Link>
        )}
      </div>
    </li>
  );
}

export function UserList({ rows, ctx, showAudit }: { rows: UserRow[]; ctx: ActionContext; showAudit: boolean }) {
  if (rows.length === 0) {
    return (
      <p className="paper rounded-2xl border p-5 text-sm text-muted-foreground" data-testid="text-users-empty">
        {t.list.empty}
      </p>
    );
  }
  return (
    <section aria-labelledby="users-heading">
      <h2 id="users-heading" className="sr-only">
        {t.list.label}
      </h2>
      <ul className="space-y-3" data-testid="list-users">
        {rows.map((row) => (
          <UserCard key={row.user_id} row={row} ctx={ctx} showAudit={showAudit} />
        ))}
      </ul>
    </section>
  );
}
