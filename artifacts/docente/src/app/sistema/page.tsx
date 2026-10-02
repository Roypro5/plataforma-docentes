export const metadata = { title: "Sistema de diseño", description: "Componentes accesibles y demostraciones locales de la base visual." };
import { es } from "@/i18n/es";
import { PageHeader } from "@/components/foundation/page-header";
import { Showcase } from "@/components/foundation/showcase";

export default function Sistema() {
  const t = es.sistema;
  return (
    <div className="space-y-10">
      <PageHeader eyebrow={t.eyebrow} title={t.title} lead={t.lead} crumb={es.nav.sistema.label} />
      <Showcase />
    </div>
  );
}
