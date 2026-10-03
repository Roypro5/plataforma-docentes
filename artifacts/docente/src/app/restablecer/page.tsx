import { AuthPage } from "@/components/cuenta/auth-page";
import { ResetForm } from "@/components/cuenta/auth-forms";
import { Notice } from "@/components/cuenta/notice";
import { getViewer } from "@/core/auth/viewer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { es } from "@/i18n/es";

export const metadata = { title: "Nueva contraseña" };

const t = es.cuenta.restablecer;

// Reached from the recovery email: the callback has already opened a session.
export default async function Restablecer() {
  const viewer = await getViewer();
  let needsMfa = false;
  if (viewer.state === "signed-in") {
    const { data } = await (await createSupabaseServerClient())!.auth.mfa.getAuthenticatorAssuranceLevel();
    needsMfa = data?.currentLevel === "aal1" && data.nextLevel === "aal2";
  }
  return (
    <AuthPage eyebrow={t.eyebrow} title={t.title} lead={t.lead} configured={viewer.state !== "unconfigured"}>
      {viewer.state === "signed-in" ? <ResetForm needsMfa={needsMfa} /> : <Notice testId="notice-reset-no-session">{t.noSession}</Notice>}
    </AuthPage>
  );
}
