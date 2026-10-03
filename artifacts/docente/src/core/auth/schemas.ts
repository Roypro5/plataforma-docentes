import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);
// Supabase enforces its own policy too; this is the minimum we ask for in the UI.
const password = z.string().min(8).max(72);

export const signInSchema = z.object({ email, password: z.string().min(1).max(72) });
export const signUpSchema = z.object({ email, password });
export const recoverSchema = z.object({ email });
export const resetSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"] });

const optionalId = z
  .string()
  .uuid()
  .or(z.literal(""))
  .transform((v) => (v === "" ? null : v));

export const onboardingStep1Schema = z.object({
  displayName: z.string().trim().min(1).max(120),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  acceptLegal: z.literal("on").optional(),
});

export const onboardingStep2Schema = z.object({
  regionId: optionalId,
  ugelId: optionalId,
  institutionName: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v)),
  employmentStatus: z
    .enum(["nombrado", "contratado", "otro", ""])
    .transform((v) => (v === "" ? null : v)),
});

export const onboardingStep3Schema = z.object({
  levels: z.array(z.string().uuid()).min(1),
  grades: z.array(z.string().uuid()),
});

export const totpCodeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) });
