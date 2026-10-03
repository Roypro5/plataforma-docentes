import { redirect } from "next/navigation";
import { PageHeader, Section } from "@/components/foundation/page-header";
import { EnrollTotp, VerifyTotpForm } from "@/components/cuenta/mfa-forms";
import { requireActiveViewer, viewerCan } from "@/core/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { es } from "@/i18n/es";

export const metadata = { title: "Verificación en dos pasos" };

const t = es.cuenta.admin;

// A newly assigned admin/superadmin enrols TOTP here before any administrative use;
// existing admins verify a code to raise the session to aal2.
export default async function AdminMfa() {
  const viewer = await requireActiveViewer({ allowIncompleteOnboarding: true });
  if (!viewerCan(viewer, "admin.access")) redirect("/admin");
  if (viewer.aal === "aal2") redirect("/admin");
  const supabase = (await createSupabaseServerClient())!;
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp?.find((f) => f.status === "verified");

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={t.mfaTitle} lead={t.mfaLead} crumb={t.mfaTitle} />
      <Section title={factor ? t.verify : t.startEnroll}>
        <div className="max-w-md">{factor ? <VerifyTotpForm factorId={factor.id} /> : <EnrollTotp />}</div>
      </Section>
    </div>
  );
}
