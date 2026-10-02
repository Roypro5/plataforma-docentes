import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { es } from "@/i18n/es";

export function PageHeader({ eyebrow, title, lead, crumb }: { eyebrow: string; title: string; lead: string; crumb?: string }) {
  return (
    <header className="rise">
      <nav aria-label={es.shell.breadcrumbLabel} className="mb-5 text-sm">
        <ol className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
          <li><Link href="/" className="hover:text-foreground" data-testid="link-breadcrumb-home">{es.shell.home}</Link></li>
          {crumb && (
            <>
              <li aria-hidden><ChevronRight className="h-3.5 w-3.5" /></li>
              <li aria-current="page" className="font-medium text-foreground">{crumb}</li>
            </>
          )}
        </ol>
      </nav>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
      <h1 className="font-display mt-2 text-3xl font-semibold leading-tight sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{lead}</p>
    </header>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="paper rise rounded-2xl border p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
