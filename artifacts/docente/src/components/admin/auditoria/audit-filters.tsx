import Link from "next/link";
import { Field } from "@/components/cuenta/form-ui";
import { btnPrimary, btnQuiet, fieldClass } from "@/components/cuenta/styles";
import { knownActions } from "@/core/admin/auditoria-format";
import type { AuditFilters } from "@/core/admin/auditoria-schemas";
import { admin } from "@/i18n/es-admin";
import { adminAuditoria } from "@/i18n/es-admin-auditoria";

const t = adminAuditoria.filters;

/** GET form: every filter travels in the query string, so a filtered view can be shared. */
export function AuditFiltersForm({ filters }: { filters: AuditFilters }) {
  const active = Boolean(filters.action || filters.actor || filters.resourceType || filters.resourceId || filters.from || filters.to);
  const actions = knownActions();
  const isKnown = filters.action ? actions.some((a) => a.code === filters.action) : true;
  return (
    <form
      method="get"
      action="/admin/auditoria"
      role="search"
      aria-label={t.legend}
      className="paper space-y-4 rounded-2xl border p-4 sm:p-5"
      data-testid="form-audit-filters"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="audit-action" label={t.action}>
          <select id="audit-action" name="action" defaultValue={filters.action ?? ""} className={fieldClass} data-testid="select-audit-action">
            <option value="">{admin.common.all}</option>
            {!isKnown && filters.action && <option value={filters.action}>{filters.action}</option>}
            {actions.map((a) => (
              <option key={a.code} value={a.code}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="audit-actor" label={t.actor} hint={t.actorHint}>
          <input
            id="audit-actor"
            name="actor"
            type="text"
            inputMode="text"
            maxLength={36}
            defaultValue={filters.actor ?? ""}
            aria-describedby="audit-actor-hint"
            autoComplete="off"
            spellCheck={false}
            className={fieldClass}
            data-testid="input-audit-actor"
          />
        </Field>
        <Field id="audit-resource-type" label={t.resourceType} hint={t.resourceTypeHint}>
          <input
            id="audit-resource-type"
            name="resource_type"
            type="text"
            list="audit-resource-types"
            maxLength={60}
            defaultValue={filters.resourceType ?? ""}
            aria-describedby="audit-resource-type-hint"
            autoComplete="off"
            spellCheck={false}
            className={fieldClass}
            data-testid="input-audit-resource-type"
          />
          <datalist id="audit-resource-types">
            {Object.keys(adminAuditoria.resourceTypes).map((type) => (
              <option key={type} value={type} label={adminAuditoria.resourceTypes[type]} />
            ))}
          </datalist>
        </Field>
        <Field id="audit-resource-id" label={t.resourceId}>
          <input
            id="audit-resource-id"
            name="resource_id"
            type="text"
            maxLength={200}
            defaultValue={filters.resourceId ?? ""}
            autoComplete="off"
            spellCheck={false}
            className={fieldClass}
            data-testid="input-audit-resource-id"
          />
        </Field>
        <Field id="audit-from" label={t.from} hint={t.dateHint}>
          <input
            id="audit-from"
            name="from"
            type="date"
            defaultValue={filters.from ?? ""}
            aria-describedby="audit-from-hint"
            className={fieldClass}
            data-testid="input-audit-from"
          />
        </Field>
        <Field id="audit-to" label={t.to} hint={t.dateHint}>
          <input
            id="audit-to"
            name="to"
            type="date"
            defaultValue={filters.to ?? ""}
            aria-describedby="audit-to-hint"
            className={fieldClass}
            data-testid="input-audit-to"
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btnPrimary} data-testid="button-audit-filter">
          {t.submit}
        </button>
        {active && (
          <Link href="/admin/auditoria" className={btnQuiet} data-testid="link-audit-clear">
            {t.clear}
          </Link>
        )}
      </div>
    </form>
  );
}
