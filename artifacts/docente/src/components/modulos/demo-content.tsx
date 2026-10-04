import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { btnQuiet } from "@/components/cuenta/styles";
import { demo } from "@/i18n/es-demo";

// Content of /modulos/demo. The page shows it only when the database says the access is "available".
export function DemoContent() {
  return (
    <div className="space-y-4" data-testid="section-demo-content">
      <p className="flex gap-3 rounded-xl bg-primary-soft p-3 text-sm font-medium text-primary" data-testid="text-demo-access">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {demo.accessGranted}
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground" data-testid="text-demo-note">
        {demo.explain}
      </p>
      <Link href="/mi-plan" className={`${btnQuiet} w-full sm:w-auto`} data-testid="link-demo-plan">
        {demo.planLink}
      </Link>
    </div>
  );
}

// Shown when the demo is locked behind the plan: the way to the plans page.
export function DemoPlansLink() {
  return (
    <div className="space-y-3" data-testid="section-demo-plans">
      <p className="text-sm leading-relaxed text-muted-foreground">{demo.plansLead}</p>
      <Link href="/planes" className={`${btnQuiet} w-full sm:w-auto`} data-testid="link-demo-planes">
        {demo.plansLink}
      </Link>
    </div>
  );
}
