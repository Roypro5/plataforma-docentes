import { notFound } from "next/navigation";
import { features } from "./features";

// Page-level gates: a page whose feature is off answers 404, exactly as if it did not exist.
// Call them first in the page, before any session or data access.

export function requireBilling(): void {
  if (!features.billing) notFound();
}

export function requireInternalPages(): void {
  if (!features.internalPages) notFound();
}
