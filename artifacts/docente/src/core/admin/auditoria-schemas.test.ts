import { describe, expect, it } from "vitest";
import { adminAuditoria } from "../../i18n/es-admin-auditoria";
import { actionLabel, actorLabel, formatDetails, formatLimaDateTime, knownActions, resourceLabel, resultLabel } from "./auditoria-format";
import { auditListArgs, isIsoDate, isRangeValid, parseAuditFilters } from "./auditoria-schemas";

const UUID = "33333333-3333-4333-8333-333333333333";

describe("parseAuditFilters", () => {
  it("reads every valid filter", () => {
    const { filters, ignored } = parseAuditFilters({
      action: "user.role_granted",
      actor: UUID,
      resource_type: "user",
      resource_id: UUID,
      from: "2026-10-01",
      to: "2026-10-03",
      page: "2",
    });
    expect(ignored).toEqual([]);
    expect(filters).toEqual({
      action: "user.role_granted",
      actor: UUID,
      resourceType: "user",
      resourceId: UUID,
      from: "2026-10-01",
      to: "2026-10-03",
      page: 2,
    });
  });

  it("drops invalid values and reports them", () => {
    const { filters, ignored } = parseAuditFilters({
      action: "DROP TABLE;",
      actor: "no-uuid",
      resource_type: "User Type",
      from: "2026-02-30",
      to: "03/10/2026",
    });
    expect(filters).toMatchObject({ action: undefined, actor: undefined, resourceType: undefined, from: undefined, to: undefined, page: 1 });
    expect(ignored).toEqual(["action", "actor", "resource_type", "from", "to"]);
  });

  it("treats empty values as absent", () => {
    const { filters, ignored } = parseAuditFilters({ action: "", actor: "  ", resource_id: "" });
    expect(ignored).toEqual([]);
    expect(filters.action).toBeUndefined();
    expect(filters.resourceId).toBeUndefined();
  });

  it("rejects a resource id over 200 characters", () => {
    expect(parseAuditFilters({ resource_id: "x".repeat(201) }).ignored).toEqual(["resource_id"]);
  });
});

describe("dates", () => {
  it("accepts only real calendar dates", () => {
    expect(isIsoDate("2026-10-03")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-1-1")).toBe(false);
  });

  it("detects a reversed range and allows a single day", () => {
    expect(isRangeValid({ from: "2026-10-03", to: "2026-10-01" })).toBe(false);
    expect(isRangeValid({ from: "2026-10-03", to: "2026-10-03" })).toBe(true);
    expect(isRangeValid({ from: "2026-10-03" })).toBe(true);
    expect(isRangeValid({})).toBe(true);
  });

  it("builds Lima-time bounds with the end day included", () => {
    const args = auditListArgs({ from: "2026-10-01", to: "2026-10-31", page: 1 });
    expect(args.p_from).toBe("2026-10-01T00:00:00-05:00");
    expect(args.p_to).toBe("2026-11-01T00:00:00-05:00");
    expect(auditListArgs({ to: "2026-12-31", page: 1 }).p_to).toBe("2027-01-01T00:00:00-05:00");
  });

  it("sends nulls for empty filters", () => {
    expect(auditListArgs({ page: 3 })).toEqual({
      p_action: null,
      p_actor: null,
      p_resource_type: null,
      p_resource_id: null,
      p_from: null,
      p_to: null,
      p_page: 3,
    });
  });

  it("formats date and time in Lima", () => {
    expect(formatLimaDateTime("2026-10-03T03:05:09Z")).toBe("02/10/2026 22:05:09");
    expect(formatLimaDateTime("2026-10-03T17:00:00Z")).toBe("03/10/2026 12:00:00");
    expect(formatLimaDateTime(null)).toBe("—");
    expect(formatLimaDateTime("mañana")).toBe("—");
  });
});

describe("action labels", () => {
  it("has a label for each known action and falls back to the code", () => {
    expect(actionLabel("user.role_granted")).toBe("Rol otorgado");
    expect(actionLabel("module.emergency_changed")).toContain("emergencia");
    expect(actionLabel("algo.nuevo")).toBe("algo.nuevo");
    expect(actionLabel("constructor")).toBe("constructor");
  });

  it("lists the actions of the contract for the filter", () => {
    const codes = knownActions().map((a) => a.code);
    for (const code of [
      "user.status_changed",
      "user.role_granted",
      "user.role_revoked",
      "user.superadmin_bootstrapped",
      "account.deleted",
      "account.deletion_requested",
      "users.searched",
      "module.status_changed",
      "module.emergency_changed",
      "module.country_changed",
      "announcement.created",
      "announcement.updated",
      "announcement.published",
      "announcement.unpublished",
      "catalog.renamed",
      "catalog.status_changed",
      "org.created",
      "org.status_changed",
      "org.members_listed",
      "org.member_added",
      "org.member_removed",
      "checkout.started",
      "payment.resolved",
      "subscription.activated",
      "subscription.canceled",
      "subscription.resumed",
      "billing.subscriptions_listed",
      "billing.payments_listed",
    ]) {
      expect(codes).toContain(code);
    }
    // Every code in the list is valid for the database filter.
    for (const code of codes) expect(code).toMatch(/^[a-z_.]+$/);
    expect(Object.keys(adminAuditoria.actions)).toHaveLength(codes.length);
  });

  it("labels results", () => {
    expect(resultLabel("success")).toBe("Correcto");
    expect(resultLabel("denied")).toBe("Denegado");
    expect(resultLabel("raro")).toBe("raro");
  });
});

describe("actor and resource", () => {
  it("shows the email, a deleted account or the system", () => {
    expect(actorLabel({ actor_user_id: UUID, actor_email: "ana@example.com" })).toBe("ana@example.com");
    expect(actorLabel({ actor_user_id: UUID, actor_email: null })).toBe("Cuenta eliminada");
    expect(actorLabel({ actor_user_id: null, actor_email: null, actor_context: "system" })).toBe("Sistema");
  });

  it("names the resource", () => {
    expect(resourceLabel("user", UUID)).toBe(`Usuario · ${UUID}`);
    expect(resourceLabel("custom", "7")).toBe("custom · 7");
    expect(resourceLabel("user", null)).toBe("Usuario");
    expect(resourceLabel(null, null)).toBe("Sin recurso");
  });
});

describe("formatDetails", () => {
  it("turns an object into labelled pairs in order", () => {
    expect(formatDetails({ status: "suspended", previous: "active" })).toEqual([
      { key: "status", label: "Estado", value: "suspended" },
      { key: "previous", label: "Estado anterior", value: "active" },
    ]);
  });

  it("formats booleans, numbers, nulls, arrays and nested values as text", () => {
    const pairs = formatDetails({ has_query: true, page: 2, role: null, list: ["a", "b"], nested: { x: 1 }, disabled: false });
    const byKey = Object.fromEntries(pairs.map((p) => [p.key, p.value]));
    expect(byKey).toEqual({ has_query: "sí", page: "2", role: "—", list: "a, b", nested: '{"x":1}', disabled: "no" });
  });

  it("keeps unknown keys as they are and clips long values", () => {
    const [pair] = formatDetails({ extra: "x".repeat(500) });
    expect(pair.label).toBe("extra");
    expect(pair.value).toHaveLength(201);
    expect(pair.value.endsWith("…")).toBe(true);
  });

  it("returns nothing for empty or non-object details", () => {
    expect(formatDetails({})).toEqual([]);
    expect(formatDetails(null)).toEqual([]);
    expect(formatDetails("texto")).toEqual([]);
    expect(formatDetails(["a"])).toEqual([]);
  });

  it("does not interpret markup: the value stays plain text", () => {
    expect(formatDetails({ note: "<script>alert(1)</script>" })[0].value).toBe("<script>alert(1)</script>");
  });
});
