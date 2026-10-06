export const metadata = { title: "Hoja de ruta", description: "Las cinco etapas aprobadas para construir la plataforma docente." };
import { es } from "@/i18n/es";
import { product } from "@/config/product";
import { PageHeader } from "@/components/foundation/page-header";
import { requireInternalPages } from "@/config/feature-guards";

export default function Ruta() {
  requireInternalPages();
  const t = es.ruta;
  return (
    <div className="space-y-10">
      <PageHeader eyebrow={t.eyebrow} title={t.title} lead={t.lead} crumb={es.nav.ruta.label} />
      <ol className="relative space-y-4 before:absolute before:bottom-4 before:left-5 before:top-4 before:w-px before:bg-border">
        {t.stages.map((s, i) => {
          const cur = s.n === product.stage;
          return (
            <li key={s.n} className={`rise relative flex gap-4 d${Math.min(i, 4)}`} aria-current={cur ? "step" : undefined}>
              <span className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 font-mono font-bold ${cur ? "border-accent bg-accent text-accent-foreground" : "border-border bg-surface text-muted-foreground"}`}>{s.n}</span>
              <div className={`paper min-w-0 flex-1 rounded-2xl border p-5 ${cur ? "border-accent/50" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-xl font-semibold">{s.title}</h2>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cur ? "bg-accent-soft text-accent" : "bg-muted text-muted-foreground"}`}>{cur ? t.current : s.n < product.stage ? t.closed : t.next}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
