import { PageHeader, Section } from "@/components/foundation/page-header";
import { legal } from "@/config/legal";
import { es } from "@/i18n/es";

export const metadata = { title: "Términos y privacidad" };

const t = es.cuenta.legal;

export default function Legal() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={t.title} lead={t.lead} crumb={t.title} />
      <Section title={`${t.title} · ${legal.status}`}>
        <p className="text-sm leading-relaxed text-muted-foreground">{t.body}</p>
        <p className="mt-3 text-sm text-muted-foreground" data-testid="text-legal-version">{t.version(legal.version)}</p>
      </Section>
    </div>
  );
}
