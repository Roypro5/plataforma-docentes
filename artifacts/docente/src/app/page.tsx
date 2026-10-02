import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Info, Smartphone, Languages, Accessibility, ShieldCheck, Lock } from "lucide-react";
import { es } from "@/i18n/es";
import { product } from "@/config/product";

const pIcons = [Smartphone, Languages, Accessibility, ShieldCheck];

export default function Home() {
  const t = es.home;
  return (
    <div className="space-y-10">
      <section className="ruled paper rise relative overflow-hidden rounded-3xl border p-6 sm:p-10">
        <span className="absolute inset-y-0 left-6 w-px bg-accent/40 sm:left-10" aria-hidden />
        <div className="relative pl-5 sm:pl-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">{t.eyebrow} · {product.name}</p>
          <h1 className="font-display mt-3 max-w-3xl text-[2rem] font-semibold leading-[1.1] sm:text-6xl">{t.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{t.lead}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/sistema" data-testid="link-cta-sistema" className="lift inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">
              {t.ctaSystem} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/hoja-de-ruta" data-testid="link-cta-ruta" className="inline-flex min-h-12 items-center justify-center rounded-xl border bg-surface px-5 font-semibold hover:bg-muted">
              {t.ctaRoadmap}
            </Link>
          </div>
        </div>
      </section>

      <div className="rise d1 flex gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4 sm:p-5" role="note">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
        <div>
          <h2 className="font-semibold">{t.honestTitle}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.honest}</p>
        </div>
      </div>

      <section className="rise d2">
        <h2 className="font-display mb-4 text-2xl font-semibold">{t.principlesTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {t.principles.map((p, i) => {
            const I = pIcons[i];
            return (
              <article key={p.title} className={`paper lift rounded-2xl border p-5 ${i === 0 ? "sm:row-span-2 sm:flex sm:flex-col sm:justify-end sm:bg-primary sm:text-primary-foreground" : ""}`}>
                <I className={`h-6 w-6 ${i === 0 ? "sm:text-gold text-primary" : "text-primary"}`} aria-hidden />
                <h3 className={`font-display mt-3 font-semibold ${i === 0 ? "sm:text-3xl text-lg" : "text-lg"}`}>{p.title}</h3>
                <p className={`mt-1 text-sm leading-relaxed ${i === 0 ? "sm:text-primary-foreground/80 text-muted-foreground" : "text-muted-foreground"}`}>{p.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <div className="rise d3 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="paper rounded-2xl border p-5 sm:p-6">
          <h2 className="font-display text-xl font-semibold">{t.modulesTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.modulesNote}</p>
          <ul className="mt-4 divide-y">
            {t.modules.map((m) => (
              <li key={m.title} className="flex items-center justify-between gap-3 py-3">
                <span className="flex min-w-0 items-center gap-3 text-muted-foreground">
                  <Lock className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{m.title}</span>
                </span>
                <span className="shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-xs">{m.stage}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="paper rounded-2xl border p-5 sm:p-6">
          <h2 className="font-display text-xl font-semibold">{t.statusTitle}</h2>
          <ul className="mt-4 space-y-3">
            {t.status.map((s) => (
              <li key={s.label} className="flex items-start gap-3 text-sm">
                {s.done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-ok" aria-hidden /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />}
                <span className="flex-1">{s.label}</span>
                <span className={`text-xs font-semibold ${s.done ? "text-ok" : "text-muted-foreground"}`}>{s.done ? t.done : t.pending}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
