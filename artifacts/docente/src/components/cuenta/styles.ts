// Shared by Server and Client Components, so it must not live in a "use client" module.
export const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-[transform,background-color] active:scale-[.98] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-muted disabled:text-muted-foreground";
export const btnPrimary = `${btn} bg-primary text-primary-foreground`;
export const btnQuiet = `${btn} border hover:bg-muted`;
export const btnDanger = `${btn} bg-danger text-background`;
export const fieldClass =
  "mt-1.5 block min-h-12 w-full rounded-xl border bg-background px-3.5 text-base outline-none focus-visible:border-ring";

export type FormState = { error?: string; ok?: string } | undefined;
