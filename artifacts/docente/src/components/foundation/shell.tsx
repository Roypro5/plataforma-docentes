"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeProvider, useTheme } from "next-themes";
import { useSyncExternalStore, type ReactNode } from "react";
import { BookOpen, HelpCircle, Home, LayoutDashboard, Map, Monitor, Moon, Palette, Sun } from "lucide-react";
import { NotificationBell } from "@/components/modulos/notification-bell";
import { es } from "@/i18n/es";
import { features } from "@/config/features";
import { product } from "@/config/product";

const allNavItems = [
  { href: "/", key: "inicio", icon: Home, internal: false },
  { href: "/sistema", key: "sistema", icon: Palette, internal: true },
  { href: "/hoja-de-ruta", key: "ruta", icon: Map, internal: true },
  { href: "/ayuda", key: "ayuda", icon: HelpCircle, internal: false },
  { href: "/panel", key: "panel", icon: LayoutDashboard, internal: false },
] as const;

// Project pages ("Sistema visual", "Hoja de ruta") are not part of the product: they only
// appear where the internal pages feature is on.
export const navItems = allNavItems.filter((item) => features.internalPages || !item.internal);

// Tailwind needs the full class name: the bottom bar has one column per item.
const mobileColumns: Record<number, string> = { 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" };

export function FoundationProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="docente-tema" disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

function Brand() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3" data-testid="link-brand">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <BookOpen className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="font-display block truncate text-lg font-semibold">{product.name}</span>
        <span className="block text-xs text-muted-foreground">{product.tagline}</span>
      </span>
    </Link>
  );
}

const subscribeMounted = () => () => {};
export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeMounted, () => true, () => false);
  const opts = [
    { v: "light", label: es.theme.light, icon: Sun },
    { v: "dark", label: es.theme.dark, icon: Moon },
    { v: "system", label: es.theme.system, icon: Monitor },
  ];
  return (
    <div role="radiogroup" aria-label={es.theme.label} className="inline-flex rounded-full border bg-muted/60 p-1">
      {opts.map((o) => {
        const on = mounted && theme === o.v;
        return (
          <button
            key={o.v}
            role="radio"
            aria-checked={on}
            tabIndex={on || (!mounted && o.v === "system") ? 0 : -1}
            aria-label={o.label}
            title={o.label}
            onClick={() => setTheme(o.v)}
            onKeyDown={(event) => {
              if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const index = opts.findIndex((option) => option.v === o.v);
              const next = event.key === "Home" ? 0 : event.key === "End" ? 2 :
                (index + (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : 2)) % 3;
              setTheme(opts[next].v);
              const buttons = event.currentTarget.parentElement?.querySelectorAll("button");
              buttons?.[next]?.focus();
            }}
            data-testid={`button-theme-${o.v}`}
            className={`flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors ${on ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <o.icon className="h-4 w-4" aria-hidden />
            {!compact && <span>{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  return (
    <div className="relative z-10 min-h-[100dvh]">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        {es.shell.skip}
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r bg-surface/80 px-5 py-6 backdrop-blur md:flex">
        <Brand />
        <div className={`mt-6 flex items-center gap-2 ${features.stageInfo ? "justify-between" : "justify-end"}`}>
          {features.stageInfo && (
            <p className="inline-flex w-fit rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">{es.shell.stageBadge}</p>
          )}
          <NotificationBell />
        </div>
        <nav aria-label={es.shell.navLabel} className="mt-8 flex flex-col gap-1">
          {navItems.map((n) => {
            const t = es.nav[n.key];
            const on = isActive(path, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={on ? "page" : undefined}
                data-testid={`link-nav-${n.key}`}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${on ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                {on && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-accent" aria-hidden />}
                <n.icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="leading-tight">
                  <span className="block text-sm font-semibold">{t.label}</span>
                  <span className="block text-xs">{t.desc}</span>
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <ThemeSwitch />
          <p className="text-xs leading-relaxed text-muted-foreground">{es.theme.note}</p>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
        <Brand />
        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />
          <ThemeSwitch compact />
        </div>
      </header>

      <div className="md:pl-72">
        <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 outline-none sm:px-6 md:pb-12 md:pt-10 lg:px-10">
          {children}
          <p className="mt-16 border-t pt-6 text-xs text-muted-foreground">{product.name} · {features.stageInfo ? es.shell.footer : es.shell.footerProduct}</p>
        </main>
      </div>

      <nav aria-label={es.shell.mobileNavLabel} className={`fixed inset-x-0 bottom-0 z-30 grid ${mobileColumns[navItems.length] ?? "grid-cols-5"} border-t bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden`}>
        {navItems.map((n) => {
          const on = isActive(path, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={on ? "page" : undefined}
              data-testid={`link-mobile-${n.key}`}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${on ? "text-primary" : "text-muted-foreground"}`}
            >
              <span className={`grid h-8 w-11 place-items-center rounded-full transition-colors ${on ? "bg-primary-soft" : ""}`}>
                <n.icon className="h-5 w-5" aria-hidden />
              </span>
              {es.nav[n.key].short}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
