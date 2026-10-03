import { ConfirmForm } from "@/components/admin/confirm-form";
import { setCatalogItemActiveAction } from "@/core/admin/catalogos-actions";
import type { CatalogRow } from "@/core/admin/catalogos-queries";
import { catalogNameMax, type CatalogKind } from "@/core/admin/catalogos-schemas";
import { adminCatalogos } from "@/i18n/es-admin-catalogos";
import { RenameForm } from "./rename-form";

const t = adminCatalogos;

function Tag({ children, tone }: { children: string; tone: "plain" | "ok" | "warn" }) {
  const cls = tone === "ok" ? "border-transparent bg-primary-soft text-primary" : tone === "warn" ? "border-accent/40 bg-accent-soft text-foreground" : "bg-muted text-foreground";
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

// Cards instead of a table: they fit 360 px without horizontal scrolling.
export function CatalogList({ kind, rows }: { kind: CatalogKind; rows: CatalogRow[] }) {
  const max = catalogNameMax(kind);
  return (
    <ul className="space-y-3" aria-label={t.list.label(t.kinds[kind].tab)} data-testid="list-catalog">
      {rows.map((row) => (
        <li key={row.id} className="paper space-y-3 rounded-2xl border p-4 sm:p-5" data-testid={`row-catalog-${row.id}`}>
          <div className="space-y-1.5">
            <h2 className="break-words text-base font-semibold">{row.name}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone={row.active ? "ok" : "plain"}>{row.active ? t.list.active : t.list.inactive}</Tag>
              {row.is_synthetic && <Tag tone="warn">{t.list.synthetic}</Tag>}
            </div>
            <p className="text-sm text-muted-foreground">
              {t.list.code}: <span className="break-all">{row.code ?? t.list.noCode}</span>
              {row.parent_name && (
                <>
                  {" · "}
                  {t.list.parent}: {row.parent_name}
                </>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
            <RenameForm kind={kind} id={row.id} name={row.name} max={max} />
            <ConfirmForm
              action={setCatalogItemActiveAction}
              fields={{ kind, id: row.id, active: row.active ? "false" : "true" }}
              label={
                <>
                  {row.active ? t.status.deactivate : t.status.activate}
                  <span className="sr-only">: {row.name}</span>
                </>
              }
              confirmTitle={row.active ? t.status.confirmTitle(row.name) : undefined}
              confirmBody={row.active ? t.status.confirmBody : undefined}
              confirmLabel={t.status.confirmLabel}
              testId={`button-catalog-active-${row.id}`}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
