import { redirect } from "next/navigation";
import { PageHeader, Section } from "@/components/foundation/page-header";
import { DeleteAccountForm } from "@/components/cuenta/delete-form";
import { signOutAction } from "@/core/auth/actions";
import { btnQuiet } from "@/components/cuenta/styles";
import { getViewer } from "@/core/auth/viewer";
import { es } from "@/i18n/es";

export const metadata = { title: "Estado de la cuenta" };

const t = es.cuenta.suspendida;

// Suspended accounts keep a way to exercise their rights: they can delete the account.
export default async function CuentaSuspendida() {
  const viewer = await getViewer();
  if (viewer.state !== "signed-in") redirect("/ingresar");
  if (viewer.status === "active") redirect("/panel");
  const pending = viewer.status === "deletion_pending";

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t.eyebrow} title={pending ? t.titlePending : t.titleSuspended}
        lead={pending ? t.bodyPending : t.bodySuspended} crumb={t.eyebrow} />
      <Section title={pending ? es.cuenta.eliminar.pendingTitle : t.delete}>
        {pending && <p className="mb-4 text-sm text-muted-foreground">{es.cuenta.eliminar.pendingBody}</p>}
        <div className="max-w-md"><DeleteAccountForm retry={pending} /></div>
        <p className="mt-6 text-sm text-muted-foreground">{t.contactPending}</p>
      </Section>
      <form action={signOutAction}>
        <button type="submit" className={btnQuiet}>{es.cuenta.perfil.signOut}</button>
      </form>
    </div>
  );
}
