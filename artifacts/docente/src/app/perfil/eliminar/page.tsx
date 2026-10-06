import Link from "next/link";
import { PageHeader, Section } from "@/components/foundation/page-header";
import { DeleteAccountForm } from "@/components/cuenta/delete-form";
import { btnQuiet } from "@/components/cuenta/styles";
import { features } from "@/config/features";
import { requireActiveViewer } from "@/core/auth/viewer";
import { es } from "@/i18n/es";

export const metadata = { title: "Eliminar cuenta" };

const t = es.cuenta.eliminar;

export default async function Eliminar() {
  await requireActiveViewer({ allowIncompleteOnboarding: true });
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={t.title} lead={t.lead} crumb={t.title} />
      <Section title={es.cuenta.perfil.dangerTitle}>
        <ul className="mb-6 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          {(features.billing ? t.points : t.pointsProduct).map((p) => <li key={p}>{p}</li>)}
        </ul>
        <div className="max-w-md space-y-4">
          <DeleteAccountForm />
          <Link href="/perfil" className={btnQuiet}>{t.cancel}</Link>
        </div>
      </Section>
    </div>
  );
}
