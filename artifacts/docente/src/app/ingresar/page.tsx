import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPage } from "@/components/cuenta/auth-page";
import { SignInForm } from "@/components/cuenta/auth-forms";
import { Notice } from "@/components/cuenta/notice";
import { btnQuiet } from "@/components/cuenta/styles";
import { signInWithGoogleAction } from "@/core/auth/actions";
import { safeNextPath } from "@/core/auth/routes";
import { getViewer } from "@/core/auth/viewer";
import { es } from "@/i18n/es";

export const metadata = { title: "Ingresar" };

const t = es.cuenta.ingresar;

export default async function Ingresar({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const reauth = params.reauth === "1";
  const viewer = await getViewer();
  if (viewer.state === "signed-in" && !reauth) redirect(next);
  const configured = viewer.state !== "unconfigured";

  return (
    <AuthPage eyebrow={t.eyebrow} title={t.title} lead={t.lead} configured={configured}
      footer={
        <p className="text-sm">
          {t.noAccount}{" "}
          <Link href="/registro" className="font-semibold text-primary underline underline-offset-4" data-testid="link-register">{t.register}</Link>
        </p>
      }>
      {reauth && <Notice testId="notice-reauth">{t.reauth}</Notice>}
      {params.eliminada === "1" && <Notice testId="notice-deleted">{t.deleted}</Notice>}
      {params.error && <Notice testId="notice-link-error">{t.callbackError}</Notice>}
      <SignInForm next={next} disabled={!configured} />
      <Link href="/recuperar" className="inline-block text-sm text-primary underline underline-offset-4" data-testid="link-recover">{t.forgot}</Link>
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />{es.cuenta.common.or}<span className="h-px flex-1 bg-border" />
      </div>
      <form action={signInWithGoogleAction}>
        <input type="hidden" name="next" value={next} />
        <button type="submit" disabled={!configured} className={`${btnQuiet} w-full`} data-testid="button-google">{t.google}</button>
      </form>
    </AuthPage>
  );
}
