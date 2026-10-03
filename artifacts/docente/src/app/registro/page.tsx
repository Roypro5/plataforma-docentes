import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPage } from "@/components/cuenta/auth-page";
import { SignUpForm } from "@/components/cuenta/auth-forms";
import { btnQuiet } from "@/components/cuenta/styles";
import { signInWithGoogleAction } from "@/core/auth/actions";
import { getViewer } from "@/core/auth/viewer";
import { es } from "@/i18n/es";

export const metadata = { title: "Crear una cuenta" };

const t = es.cuenta.registro;

export default async function Registro() {
  const viewer = await getViewer();
  if (viewer.state === "signed-in") redirect("/panel");
  const configured = viewer.state !== "unconfigured";

  return (
    <AuthPage eyebrow={t.eyebrow} title={t.title} lead={t.lead} configured={configured}
      footer={
        <p className="text-sm">
          {t.hasAccount}{" "}
          <Link href="/ingresar" className="font-semibold text-primary underline underline-offset-4" data-testid="link-sign-in">{t.signIn}</Link>
        </p>
      }>
      <SignUpForm disabled={!configured} />
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />{es.cuenta.common.or}<span className="h-px flex-1 bg-border" />
      </div>
      <form action={signInWithGoogleAction}>
        <input type="hidden" name="next" value="/panel" />
        <button type="submit" disabled={!configured} className={`${btnQuiet} w-full`} data-testid="button-google">{es.cuenta.ingresar.google}</button>
      </form>
    </AuthPage>
  );
}
