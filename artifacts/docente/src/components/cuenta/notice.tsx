import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

export function Notice({ title, children, testId }: { title?: string; children: ReactNode; testId?: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4" role="note" data-testid={testId}>
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
      <div className="text-sm leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}
