import type { ReactNode } from "react";
import { PageHeader } from "@/components/foundation/page-header";
import { features } from "@/config/features";
import { es } from "@/i18n/es";
import { Notice } from "./notice";

// Frame shared by the sign-in, sign-up and recovery pages.
export function AuthPage({ eyebrow, title, lead, configured, children, footer }: {
  eyebrow: string; title: string; lead: string; configured: boolean; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={eyebrow} title={title} lead={lead} crumb={title} />
      <div className="rise d1 max-w-md space-y-5">
        {!configured && (
          <Notice title={es.cuenta.common.notConfiguredTitle} testId="notice-auth-unconfigured">
            {es.cuenta.common.notConfiguredBody}
          </Notice>
        )}
        <div className="paper space-y-5 rounded-2xl border p-5 sm:p-6">{children}</div>
        {features.stageInfo && <p className="text-xs text-muted-foreground">{es.cuenta.common.testEnvironment}</p>}
        {footer}
      </div>
    </div>
  );
}
