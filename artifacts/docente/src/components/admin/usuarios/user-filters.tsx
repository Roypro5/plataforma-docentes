import Link from "next/link";
import { Field } from "@/components/cuenta/form-ui";
import { btnPrimary, btnQuiet, fieldClass } from "@/components/cuenta/styles";
import { roleCodes } from "@/core/auth/permissions";
import { MAX_QUERY_LENGTH, USER_STATUSES, type UserFilters } from "@/core/admin/usuarios-schemas";
import { admin } from "@/i18n/es-admin";
import { adminUsuarios } from "@/i18n/es-admin-usuarios";

const t = adminUsuarios.filters;

/** GET form: filters travel in the query string, so results can be shared and the pager keeps them. */
export function UserFiltersForm({ filters }: { filters: UserFilters }) {
  const active = Boolean(filters.q || filters.status || filters.role);
  return (
    <form
      method="get"
      action="/admin/usuarios"
      role="search"
      aria-label={t.legend}
      className="paper space-y-4 rounded-2xl border p-4 sm:p-5"
      data-testid="form-user-filters"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Field id="user-q" label={t.query} hint={t.queryHint}>
            <input
              id="user-q"
              name="q"
              type="search"
              maxLength={MAX_QUERY_LENGTH}
              defaultValue={filters.q ?? ""}
              aria-describedby="user-q-hint"
              autoComplete="off"
              className={fieldClass}
              data-testid="input-user-query"
            />
          </Field>
        </div>
        <Field id="user-status" label={t.status}>
          <select id="user-status" name="status" defaultValue={filters.status ?? ""} className={fieldClass} data-testid="select-user-status">
            <option value="">{admin.common.all}</option>
            {USER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {adminUsuarios.status[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="user-role" label={t.role}>
          <select id="user-role" name="role" defaultValue={filters.role ?? ""} className={fieldClass} data-testid="select-user-role">
            <option value="">{admin.common.all}</option>
            {roleCodes.map((r) => (
              <option key={r} value={r}>
                {adminUsuarios.roles[r]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btnPrimary} data-testid="button-user-search">
          {t.submit}
        </button>
        {active && (
          <Link href="/admin/usuarios" className={btnQuiet} data-testid="link-user-clear">
            {t.clear}
          </Link>
        )}
      </div>
    </form>
  );
}
