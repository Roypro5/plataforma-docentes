"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { BellOff, BellPlus } from "lucide-react";
import { registerInterestAction, withdrawInterestAction } from "@/core/modules/actions";
import { FormMessage } from "@/components/cuenta/form-ui";
import { btnPrimary, btnQuiet } from "@/components/cuenta/styles";
import { es } from "@/i18n/es";

const t = es.modulos.notify;

function ToggleButton({ interested, moduleName, moduleId }: { interested: boolean; moduleName: string; moduleId: string }) {
  const { pending } = useFormStatus();
  const Icon = interested ? BellOff : BellPlus;
  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={interested}
      aria-label={interested ? t.withdrawFor(moduleName) : t.buttonFor(moduleName)}
      className={`${interested ? btnQuiet : btnPrimary} w-full sm:w-auto`}
      data-testid={`button-interest-${moduleId}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {pending ? t.sending : interested ? t.withdraw : t.button}
    </button>
  );
}

// "Avísame" toggle for modules that are coming soon. The server decides whether the change is
// allowed; the page re-renders with the new state after the Server Action revalidates /panel.
export function InterestToggle({ moduleId, moduleName, interested }: { moduleId: string; moduleName: string; interested: boolean }) {
  const [state, action] = useActionState(interested ? withdrawInterestAction : registerInterestAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="moduleId" value={moduleId} />
      <ToggleButton interested={interested} moduleName={moduleName} moduleId={moduleId} />
      <FormMessage state={state} />
    </form>
  );
}
