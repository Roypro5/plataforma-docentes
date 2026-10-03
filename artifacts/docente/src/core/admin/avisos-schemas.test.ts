import { describe, expect, it } from "vitest";
import { adminAvisos } from "../../i18n/es-admin-avisos";
import {
  announcementFormToInput,
  announcementIdSchema,
  announcementSaveSchema,
  BODY_MAX,
  firstAnnouncementError,
  isAnnouncementStatus,
  TITLE_MAX,
} from "./avisos-schemas";

const valid = {
  id: "",
  title: "  Reunión de inicio  ",
  body: "Primera línea\r\nSegunda línea",
  startsAt: "2026-10-05T08:00",
  endsAt: "2026-10-12T18:00",
  countries: ["PE", "PE"],
  roles: ["docente"],
  plans: [],
};

function errorOf(input: unknown) {
  const r = announcementSaveSchema.safeParse(input);
  return r.success ? null : firstAnnouncementError(r.error);
}

describe("announcement save schema", () => {
  it("accepts a valid draft and normalises it", () => {
    const r = announcementSaveSchema.parse(valid);
    expect(r.id).toBeNull();
    expect(r.title).toBe("Reunión de inicio");
    expect(r.body).toBe("Primera línea\nSegunda línea");
    expect(r.startsAt).toBe("2026-10-05T08:00:00-05:00");
    expect(r.endsAt).toBe("2026-10-12T18:00:00-05:00");
    expect(r.countries).toEqual(["PE"]);
  });

  it("keeps an existing id and allows empty dates and audience", () => {
    const id = "6f1c7a2e-8d3b-4c51-9a0e-2b7d5e4f3a10";
    const r = announcementSaveSchema.parse({ ...valid, id, startsAt: "", endsAt: "", countries: [], roles: [], plans: [] });
    expect(r.id).toBe(id);
    expect(r.startsAt).toBeNull();
    expect(r.endsAt).toBeNull();
  });

  it("limits the title to 1-120 characters on one line", () => {
    expect(errorOf({ ...valid, title: "   " })).toBe("title");
    expect(errorOf({ ...valid, title: "a".repeat(TITLE_MAX + 1) })).toBe("title");
    expect(errorOf({ ...valid, title: "a".repeat(TITLE_MAX) })).toBeNull();
    expect(errorOf({ ...valid, title: "Línea 1\nLínea 2" })).toBe("title");
  });

  it("limits the body to 1-2000 characters and refuses control characters", () => {
    expect(errorOf({ ...valid, body: "" })).toBe("body");
    expect(errorOf({ ...valid, body: "x".repeat(BODY_MAX + 1) })).toBe("body");
    expect(errorOf({ ...valid, body: "x".repeat(BODY_MAX) })).toBeNull();
    expect(errorOf({ ...valid, body: "con\u0007alarma" })).toBe("body");
    expect(errorOf({ ...valid, body: "con\ttabulación\ny salto" })).toBeNull();
  });

  it("counts a Windows line break as one character", () => {
    const body = "a\r\n".repeat(BODY_MAX / 2 - 1) + "a";
    expect(errorOf({ ...valid, body })).toBeNull();
  });

  it("requires the end to be after the start", () => {
    expect(errorOf({ ...valid, startsAt: "2026-10-05T08:00", endsAt: "2026-10-05T08:00" })).toBe("range");
    expect(errorOf({ ...valid, startsAt: "2026-10-05T08:00", endsAt: "2026-10-04T08:00" })).toBe("range");
    expect(errorOf({ ...valid, startsAt: "2026-10-05T08:00", endsAt: "2026-10-05T08:01" })).toBeNull();
  });

  it("rejects dates that do not exist", () => {
    expect(errorOf({ ...valid, startsAt: "2026-02-30T08:00" })).toBe("startsAt");
    expect(errorOf({ ...valid, endsAt: "pronto" })).toBe("endsAt");
  });

  it("rejects unknown roles, plans and country codes", () => {
    expect(errorOf({ ...valid, roles: ["root"] })).toBe("role");
    expect(errorOf({ ...valid, plans: ["premium"] })).toBe("plan");
    expect(errorOf({ ...valid, countries: ["Peru"] })).toBe("country");
    expect(errorOf({ ...valid, roles: ["docente", "admin", "superadmin"], plans: ["gratis", "individual", "institucional"] })).toBeNull();
  });

  it("rejects an id that is not a uuid", () => {
    expect(errorOf({ ...valid, id: "123" })).toBe("id");
  });

  it("has a message for every error key", () => {
    for (const key of ["title", "body", "startsAt", "endsAt", "range", "country", "role", "plan", "id", "invalid"] as const) {
      expect(adminAvisos.errors[key]).toBeTruthy();
    }
  });
});

describe("announcement form reading", () => {
  it("collects repeated checkboxes and ignores files", () => {
    const form = new FormData();
    form.set("title", "T");
    form.append("countries", "PE");
    form.append("roles", "docente");
    form.append("roles", "admin");
    form.set("body", new Blob(["x"]) as unknown as string);
    const input = announcementFormToInput(form);
    expect(input.countries).toEqual(["PE"]);
    expect(input.roles).toEqual(["docente", "admin"]);
    expect(input.title).toBe("T");
    expect(input.body).toBe("");
    expect(input.id).toBe("");
  });
});

describe("announcement helpers", () => {
  it("validates ids and statuses", () => {
    expect(announcementIdSchema.safeParse({ id: "6f1c7a2e-8d3b-4c51-9a0e-2b7d5e4f3a10" }).success).toBe(true);
    expect(announcementIdSchema.safeParse({ id: "x" }).success).toBe(false);
    expect(isAnnouncementStatus("draft")).toBe(true);
    expect(isAnnouncementStatus("published")).toBe(true);
    expect(isAnnouncementStatus("archived")).toBe(false);
    expect(isAnnouncementStatus(undefined)).toBe(false);
  });
});
