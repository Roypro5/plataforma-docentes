import { z } from "zod";
import { limaInputToIso } from "./avisos-dates";

// Platform roles only: announcement audiences match user_roles, and director is an institutional role.
export const announcementRoles = ["docente", "admin", "superadmin"] as const;
export const announcementPlans = ["gratis", "individual", "institucional"] as const;
export const announcementStatuses = ["draft", "published"] as const;

export const TITLE_MAX = 120;
export const BODY_MAX = 2000;

export type AnnouncementRole = (typeof announcementRoles)[number];
export type AnnouncementPlan = (typeof announcementPlans)[number];
export type AnnouncementStatus = (typeof announcementStatuses)[number];

// Messages of the schema are keys of es-admin-avisos.ts › errors, so the action can show the
// right text for the first problem found.
export type AnnouncementErrorKey = "title" | "body" | "startsAt" | "endsAt" | "range" | "country" | "role" | "plan" | "id" | "invalid";

// Same rule as the table: the title has no control characters; the body allows tab and line breaks.
function hasControlChars(value: string, allowed: readonly number[]): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if ((code < 0x20 || code === 0x7f) && !allowed.includes(code)) return true;
  }
  return false;
}

const optionalLimaDate = (key: "startsAt" | "endsAt") =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const iso = limaInputToIso(value);
      if (!iso) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: key });
        return z.NEVER;
      }
      return iso;
    });

const unique = <T>(values: T[]): T[] => [...new Set(values)];

export const announcementSaveSchema = z
  .object({
    id: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.string().uuid("id").nullable()),
    title: z
      .string()
      .trim()
      .pipe(z.string().min(1, "title").max(TITLE_MAX, "title"))
      .refine((v) => !hasControlChars(v, []), "title"),
    body: z
      .string()
      .transform((v) => v.replace(/\r\n?/g, "\n").trim())
      .pipe(z.string().min(1, "body").max(BODY_MAX, "body"))
      .refine((v) => !hasControlChars(v, [0x09, 0x0a, 0x0d]), "body"),
    startsAt: optionalLimaDate("startsAt"),
    endsAt: optionalLimaDate("endsAt"),
    countries: z.array(z.string().regex(/^[A-Z]{2}$/, "country")).max(50, "country").transform(unique),
    roles: z.array(z.enum(announcementRoles, { errorMap: () => ({ message: "role" }) })).transform(unique),
    plans: z.array(z.enum(announcementPlans, { errorMap: () => ({ message: "plan" }) })).transform(unique),
  })
  .superRefine((value, ctx) => {
    if (value.startsAt && value.endsAt && Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "range" });
    }
  });

export type AnnouncementSaveInput = z.output<typeof announcementSaveSchema>;

export const announcementIdSchema = z.object({ id: z.string().uuid() });

/** Reads the announcement form. Missing fields become empty values; the schema decides what is valid. */
export function announcementFormToInput(form: FormData) {
  const text = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v : "";
  };
  const list = (name: string) => form.getAll(name).filter((v): v is string => typeof v === "string");
  return {
    id: text("id"),
    title: text("title"),
    body: text("body"),
    startsAt: text("startsAt"),
    endsAt: text("endsAt"),
    countries: list("countries"),
    roles: list("roles"),
    plans: list("plans"),
  };
}

/** Key of the message for the first problem of a failed parse. */
export function firstAnnouncementError(error: z.ZodError): AnnouncementErrorKey {
  const message = error.issues[0]?.message;
  const keys: readonly string[] = ["title", "body", "startsAt", "endsAt", "range", "country", "role", "plan", "id"];
  return keys.includes(message ?? "") ? (message as AnnouncementErrorKey) : "invalid";
}

export function isAnnouncementStatus(value: unknown): value is AnnouncementStatus {
  return typeof value === "string" && (announcementStatuses as readonly string[]).includes(value);
}
