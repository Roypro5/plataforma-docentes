import { PageHeader } from "@/components/foundation/page-header";
import { Notice } from "@/components/cuenta/notice";
import { requireAdmin } from "@/core/auth/viewer";
import { es } from "@/i18n/es";

export const metadata = { title: "Administración" };

const t = es.cuenta.admin;

export default async function Admin() {
  const { allowed } = await requireAdmin();
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={t.title} lead={allowed ? t.lead : t.denied} crumb={t.eyebrow} />
      {!allowed && <Notice testId="notice-admin-denied">{t.denied}</Notice>}
    </div>
  );
}
