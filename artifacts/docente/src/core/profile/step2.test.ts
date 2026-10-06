import { describe, expect, it } from "vitest";
import { onboardingStep2Schema } from "../auth/schemas";
import { step2Fields } from "./step2";

const REGION = "3f2b1c0e-8a4d-4c1e-9b7a-2d5e6f7a8b9c";
const UGEL = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

// The form data the server action builds: a missing field reads as "".
function parse(fields: Record<string, string>) {
  return onboardingStep2Schema.parse({
    regionId: fields.regionId ?? "",
    ugelId: fields.ugelId ?? "",
    institutionName: fields.institutionName ?? "",
    employmentStatus: fields.employmentStatus ?? "",
  });
}

describe("step 2 without territory", () => {
  it("accepts a form that has no region or UGEL fields", () => {
    expect(parse({ institutionName: "IE 123", employmentStatus: "nombrado" })).toEqual({
      regionId: null, ugelId: null, institutionName: "IE 123", employmentStatus: "nombrado",
    });
    expect(parse({})).toEqual({ regionId: null, ugelId: null, institutionName: null, employmentStatus: null });
  });

  it("leaves the saved region and UGEL untouched when the form did not offer them", () => {
    const fields = step2Fields(parse({ institutionName: "IE 123" }), false);
    expect(fields).toEqual({ institution_name: "IE 123", employment_status: null });
    expect("region_id" in fields).toBe(false);
    expect("ugel_id" in fields).toBe(false);
  });
});

describe("step 2 with territory", () => {
  it("writes region and UGEL when the form offered them", () => {
    expect(step2Fields(parse({ regionId: REGION, ugelId: UGEL }), true)).toMatchObject({ region_id: REGION, ugel_id: UGEL });
  });

  it("clears the UGEL when there is no region, and both when the user picks none", () => {
    expect(step2Fields(parse({ ugelId: UGEL }), true)).toMatchObject({ region_id: null, ugel_id: null });
    expect(step2Fields(parse({}), true)).toMatchObject({ region_id: null, ugel_id: null });
  });

  it("rejects values that are not ids", () => {
    expect(onboardingStep2Schema.safeParse({ regionId: "lima", ugelId: "", institutionName: "", employmentStatus: "" }).success).toBe(false);
  });
});
