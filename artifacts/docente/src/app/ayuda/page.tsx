export const metadata = { title: "Ayuda", description: "Alcance de esta versión de prueba y respuestas frecuentes." };
import { ChevronDown, Mail } from "lucide-react";
import { es } from "@/i18n/es";
import { PageHeader, Section } from "@/components/foundation/page-header";

export default function Ayuda() {
  const t = es.ayuda;
  return (
    <div className="space-y-10">
      <PageHeader eyebrow={t.eyebrow} title={t.title} lead={t.lead} crumb={es.nav.ayuda.label} />
      <div className="rise d1 space-y-3">
        {t.faq.map((f, i) => (
          <details key={f.q} className="paper group rounded-2xl border" data-testid={`faq-${i}`}>
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
              {f.q}
              <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
      <Section title={t.contactTitle}>
        <div className="flex gap-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-sm leading-relaxed text-muted-foreground" data-testid="text-contact-pending">{t.contactPending}</p>
        </div>
      </Section>
    </div>
  );
}
