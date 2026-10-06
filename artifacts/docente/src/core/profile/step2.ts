import type { z } from "zod";
import type { onboardingStep2Schema } from "../auth/schemas";

export type Step2Data = z.infer<typeof onboardingStep2Schema>;

/**
 * Columns written by step 2 of the profile. Region and UGEL are optional and depend on whether the
 * form offered them: with no territory data the form omits both fields, and then the saved region
 * and UGEL are left untouched instead of being cleared. This does not depend on the environment.
 */
export function step2Fields(data: Step2Data, territoryOffered: boolean) {
  return {
    ...(territoryOffered ? { region_id: data.regionId, ugel_id: data.regionId ? data.ugelId : null } : {}),
    institution_name: data.institutionName,
    employment_status: data.employmentStatus,
  };
}
