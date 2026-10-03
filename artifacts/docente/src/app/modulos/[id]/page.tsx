import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { PageHeader, Section } from "@/components/foundation/page-header";
import { btnQuiet } from "@/components/cuenta/styles";
import { AccessBadge } from "@/components/modulos/module-card";
import { requireActiveViewer } from "@/core/auth/viewer";
import { listMyModules } from "@/core/modules/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { es } from "@/i18n/es";
import { resolveAppEnv } from "@/core/modules/access";
import { getModuleManifest, isModuleId } from "@/modules/registry";

export const metadata = { title: "Módulo" };

const t = es.modulos;

// The access state is checked again here, on the server, every time: hiding a card on the
// panel is never the only protection. Only "available" shows module content.
export default async function Modulo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isModuleId(id)) notFound();
  // The environment rule does not depend on the database answering.
  if (getModuleManifest(id)?.devOnly && resolveAppEnv(process.env.NEXT_PUBLIC_APP_ENV) === "production") notFound();
  await requireActiveViewer();
  const supabase = (await createSupabaseServerClient())!;
  const { modules, failed } = await listMyModules(supabase);
  const entry = modules.find((m) => m.id === id);
  // Hidden for this user (country, environment, unknown to the database): the page does not exist for them.
  if (!entry && !failed) notFound();

  const item = t.items[id];
  const access = entry?.access;
  const available = access === "available";

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t.page.eyebrow} title={item.name} lead={item.description} crumb={item.name} />

      {available ? (
        <Section title={t.page.contentTitle} aside={<AccessBadge access="available" />}>
          {id === "demo" ? (
            <p className="text-sm leading-relaxed text-muted-foreground" data-testid="text-demo-note">{t.page.demoNote}</p>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">{t.accessNote.available}</p>
          )}
        </Section>
      ) : (
        <Section title={t.page.blockedTitle} aside={access ? <AccessBadge access={access} /> : undefined}>
          <div className="flex gap-3" data-testid="section-module-blocked">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="space-y-2 text-sm leading-relaxed">
              {access && <p className="font-medium">{t.accessNote[access]}</p>}
              <p className="text-muted-foreground">{failed ? es.modulos.panel.loadError : t.page.blockedBody}</p>
            </div>
          </div>
        </Section>
      )}

      <Link href="/panel" className={`${btnQuiet} w-full sm:w-auto`} data-testid="link-back-panel">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t.page.back}
      </Link>
    </div>
  );
}
