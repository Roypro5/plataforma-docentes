import Link from "next/link";
import { ConfirmForm } from "@/components/admin/confirm-form";
import { btnQuiet } from "@/components/cuenta/styles";
import { formatLima } from "@/core/admin/avisos-dates";
import { setOrgStatusAction } from "@/core/admin/organizaciones-actions";
import type { OrgRow } from "@/core/admin/organizaciones-queries";
import { adminOrgs } from "@/i18n/es-admin-organizaciones";

const t = adminOrgs;

export function OrgStatusTag({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${active ? "border-transparent bg-primary-soft text-primary" : "bg-muted text-foreground"}`}
      data-testid={`badge-org-${status}`}
    >
      {active ? t.status.active : status === "inactive" ? t.status.inactive : status}
    </span>
  );
}

/** Activate/deactivate button with its confirmation, shared by the list and the detail page. */
export function OrgStatusForm({ id, name, status }: { id: string; name: string; status: string }) {
  const active = status === "active";
  return (
    <ConfirmForm
      action={setOrgStatusAction}
      fields={{ org: id, status: active ? "inactive" : "active" }}
      label={
        <>
          {active ? t.status.deactivate : t.status.activate}
          <span className="sr-only">: {name}</span>
        </>
      }
      confirmTitle={active ? t.status.deactivateConfirmTitle(name) : t.status.activateConfirmTitle(name)}
      confirmBody={active ? t.status.deactivateConfirmBody : t.status.activateConfirmBody}
      confirmLabel={active ? t.status.deactivateConfirmLabel : t.status.activateConfirmLabel}
      testId={`button-org-status-${id}`}
    />
  );
}

// Cards instead of a table: they fit 360 px without horizontal scrolling.
export function OrgList({ rows, countryNames }: { rows: OrgRow[]; countryNames: Record<string, string> }) {
  return (
    <ul className="space-y-3" aria-label={t.list.label} data-testid="list-orgs">
      {rows.map((row) => (
        <li key={row.id} className="paper space-y-3 rounded-2xl border p-4 sm:p-5" data-testid={`row-org-${row.id}`}>
          <div className="space-y-1.5">
            <h2 className="break-words text-base font-semibold">{row.name}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <OrgStatusTag status={row.status} />
              {!row.is_test && <span className="inline-flex min-h-7 items-center rounded-full border border-accent/40 bg-accent-soft px-2.5 text-xs font-semibold">{t.list.notTest}</span>}
            </div>
            <p className="text-sm text-muted-foreground">
              {t.list.country}: {countryNames[row.country_code] ?? row.country_code} · {t.list.members(Number(row.member_count))} · {t.list.created} {formatLima(row.created_at)}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
            <Link href={`/admin/organizaciones/${row.id}`} className={btnQuiet} aria-label={t.list.manageFor(row.name)} data-testid={`link-org-${row.id}`}>
              {t.list.manage}
            </Link>
            {row.is_test ? <OrgStatusForm id={row.id} name={row.name} status={row.status} /> : <p className="self-center text-sm text-muted-foreground">{t.list.notTestNote}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
