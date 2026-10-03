import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { btnPrimary } from "@/components/cuenta/styles";
import { InterestToggle } from "@/components/modulos/interest-toggle";
import type { ModuleAccess } from "@/core/modules/access";
import type { ModuleView } from "@/core/modules/views";
import { es } from "@/i18n/es";

const t = es.modulos;

// Badge colors only use token pairs that already meet AA contrast in both themes.
export const accessBadgeClass: Record<ModuleAccess, string> = {
  available: "bg-primary-soft text-primary",
  coming_soon: "bg-accent-soft text-accent",
  requires_entitlement: "bg-muted text-foreground",
  disabled: "bg-danger-soft text-danger",
};

export function AccessBadge({ access }: { access: ModuleAccess }) {
  return (
    <span className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${accessBadgeClass[access]}`} data-testid="badge-access">
      {t.access[access]}
    </span>
  );
}

// One card per module the user can see. The action depends on the access state computed by SQL:
// only "coming_soon" offers the notify toggle and only "available" links to the module page.
export function ModuleCard({ entry }: { entry: ModuleView }) {
  const { id, access, interested, manifest } = entry;
  const item = t.items[id];
  const Icon = manifest.icon;
  return (
    <li>
      <article className="paper flex h-full flex-col gap-4 rounded-2xl border p-5" data-testid={`card-module-${id}`} aria-labelledby={`module-${id}-name`}>
        <div className="flex items-start justify-between gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <AccessBadge access={access} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 id={`module-${id}-name`} className="font-display break-words text-lg font-semibold leading-snug">{item.name}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          <p className="text-sm leading-relaxed">{t.accessNote[access]}</p>
          {access === "coming_soon" && interested && <p className="text-sm font-medium text-primary">{t.panel.interested}</p>}
        </div>
        {access === "coming_soon" && <InterestToggle moduleId={id} moduleName={item.name} interested={interested} />}
        {access === "available" && (
          <Link href={`/modulos/${id}`} aria-label={t.panel.openFor(item.name)} className={`${btnPrimary} w-full sm:w-auto sm:self-start`} data-testid={`link-module-${id}`}>
            {t.panel.open}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </article>
    </li>
  );
}
