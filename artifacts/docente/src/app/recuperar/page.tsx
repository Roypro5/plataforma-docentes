import Link from "next/link";
import { AuthPage } from "@/components/cuenta/auth-page";
import { RecoverForm } from "@/components/cuenta/auth-forms";
import { getViewer } from "@/core/auth/viewer";
import { es } from "@/i18n/es";

export const metadata = { title: "Recuperar contraseña" };

const t = es.cuenta.recuperar;

export default async function Recuperar() {
  const configured = (await getViewer()).state !== "unconfigured";
  return (
    <AuthPage eyebrow={t.eyebrow} title={t.title} lead={t.lead} configured={configured}
      footer={<Link href="/ingresar" className="text-sm text-primary underline underline-offset-4">{es.cuenta.common.back}</Link>}>
      <RecoverForm disabled={!configured} />
    </AuthPage>
  );
}
