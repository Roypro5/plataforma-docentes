import Link from "next/link";
import { ArrowRight, Bell, Info, LayoutDashboard, Lock, UserPlus, UserRound } from "lucide-react";
import { btnPrimary, btnQuiet } from "@/components/cuenta/styles";
import { product } from "@/config/product";
import { es } from "@/i18n/es";
import { moduleManifests } from "@/modules/registry";

// Home page of production: the product, not the project. It lists only what exists today and
// never shows stages, test notices or links to the internal pages.
const todayIcons = [UserPlus, UserRound, LayoutDashboard, Bell];

const plannedModules = moduleManifests.filter((m) => !m.devOnly).map((m) => es.modulos.items[m.id].name);

export function ProductHome() {
  const t = es.home;
  const p = es.homeProduct;
  return (
    <div className="space-y-10">
      <section className="ruled paper rise relative overflow-hidden rounded-3xl border p-6 sm:p-10">
        <span className="absolute inset-y-0 left-6 w-px bg-accent/40 sm:left-10" aria-hidden />
        <div className="relative pl-5 sm:pl-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">{t.eyebrow} · {product.name}</p>
          <h1 className="font-display mt-3 max-w-3xl text-[2rem] font-semibold leading-[1.1] sm:text-6xl">{t.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{p.lead}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/registro" data-testid="link-cta-registro" className={`${btnPrimary} lift min-h-12 px-5 text-base`}>
              {p.ctaRegister} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/ingresar" data-testid="link-cta-ingresar" className={`${btnQuiet} min-h-12 bg-surface px-5 text-base`}>
              {p.ctaSignIn}
            </Link>
          </div>
        </div>
      </section>

      <section className="rise d1" aria-labelledby="home-today">
        <h2 id="home-today" className="font-display mb-4 text-2xl font-semibold">{p.todayTitle}</h2>
        <ul className="grid gap-4 sm:grid-cols-2" data-testid="list-home-today">
          {p.today.map((item, i) => {
            const Icon = todayIcons[i];
            return (
              <li key={item.title} className="paper lift rounded-2xl border p-5">
                <Icon className="h-6 w-6 text-primary" aria-hidden />
                <h3 className="font-display mt-3 text-lg font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rise d2 paper rounded-2xl border p-5 sm:p-6" aria-labelledby="home-soon">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <div>
            <h2 id="home-soon" className="font-display text-xl font-semibold">{p.soonTitle}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.soonBody}</p>
          </div>
        </div>
        <ul className="mt-4 divide-y" data-testid="list-home-planned">
          {plannedModules.map((name) => (
            <li key={name} className="flex items-center justify-between gap-3 py-3">
              <span className="flex min-w-0 items-center gap-3 text-muted-foreground">
                <Lock className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 break-words">{name}</span>
              </span>
              <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs">{p.soonBadge}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rise d3">
        <h2 className="font-display mb-4 text-2xl font-semibold">{t.principlesTitle}</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {t.principles.map((item) => (
            <li key={item.title} className="paper rounded-2xl border p-5">
              <h3 className="font-display text-lg font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
