import { z } from "zod";

export const orgStatuses = ["active", "inactive"] as const;
export const memberRoles = ["docente", "director"] as const;

export type OrgStatus = (typeof orgStatuses)[number];
export type MemberRole = (typeof memberRoles)[number];

export const ORG_NAME_MAX = 200;
export const EMAIL_MAX = 254;

export function isOrgStatus(value: unknown): value is OrgStatus {
  return typeof value === "string" && (orgStatuses as readonly string[]).includes(value);
}

export function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === "string" && (memberRoles as readonly string[]).includes(value);
}

const uuid = z.string().uuid();

export const orgCreateSchema = z.object({
  name: z.string().trim().min(1, "name").max(ORG_NAME_MAX, "name"),
  country: z.string().regex(/^[A-Z]{2}$/, "country"),
});

export const orgStatusSchema = z.object({ org: uuid, status: z.enum(orgStatuses) });

export const orgMemberAddSchema = z.object({
  org: uuid,
  email: z.string().trim().toLowerCase().min(1, "email").max(EMAIL_MAX, "email").email("email"),
  role: z.enum(memberRoles, { errorMap: () => ({ message: "role" }) }),
});

export const orgMemberRemoveSchema = z.object({ org: uuid, user: uuid });

export type OrgErrorKey = "name" | "country" | "email" | "role" | "invalid";

/** Key of the message for the first problem of a failed parse. */
export function firstOrgError(error: z.ZodError): OrgErrorKey {
  const message = error.issues[0]?.message;
  return message === "name" || message === "country" || message === "email" || message === "role" ? message : "invalid";
}
