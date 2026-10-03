import { describe, expect, it } from "vitest";
import {
  assignableRoles,
  auditLinkForUser,
  formatLimaDate,
  parseUserFilters,
  roleChangeSchema,
  rowActions,
  setStatusSchema,
  userListArgs,
  type ActionContext,
} from "./usuarios-schemas";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("parseUserFilters", () => {
  it("reads valid filters", () => {
    expect(parseUserFilters({ q: "  maria ", status: "suspended", role: "admin", page: "3" })).toEqual({
      q: "maria",
      status: "suspended",
      role: "admin",
      page: 3,
    });
  });

  it("drops invalid values instead of sending them to the database", () => {
    const f = parseUserFilters({ q: "   ", status: "banned", role: "root", page: "-1" });
    expect(f).toEqual({ q: undefined, status: undefined, role: undefined, page: 1 });
  });

  it("limits the query to 100 characters and takes the first repeated value", () => {
    expect(parseUserFilters({ q: "a".repeat(150) }).q).toHaveLength(100);
    expect(parseUserFilters({ q: ["uno", "dos"] }).q).toBe("uno");
  });

  it("builds the RPC arguments with nulls for empty filters", () => {
    expect(userListArgs(parseUserFilters({}))).toEqual({ p_query: null, p_status: null, p_role: null, p_page: 1 });
    expect(userListArgs(parseUserFilters({ q: "x", role: "docente", page: "2" }))).toEqual({
      p_query: "x",
      p_status: null,
      p_role: "docente",
      p_page: 2,
    });
  });
});

describe("action schemas", () => {
  it("accepts only uuid and the two statuses an admin can set", () => {
    expect(setStatusSchema.safeParse({ userId: OTHER, status: "suspended" }).success).toBe(true);
    expect(setStatusSchema.safeParse({ userId: OTHER, status: "active" }).success).toBe(true);
    expect(setStatusSchema.safeParse({ userId: OTHER, status: "deletion_pending" }).success).toBe(false);
    expect(setStatusSchema.safeParse({ userId: "no-uuid", status: "active" }).success).toBe(false);
  });

  it("accepts only the assignable roles", () => {
    for (const role of ["docente", "admin", "superadmin"]) {
      expect(roleChangeSchema.safeParse({ userId: OTHER, role }).success).toBe(true);
    }
    for (const role of ["creador", "revisor", "director", "", null]) {
      expect(roleChangeSchema.safeParse({ userId: OTHER, role }).success).toBe(false);
    }
  });
});

describe("assignableRoles", () => {
  it("offers admin and superadmin only with the privileged permission", () => {
    expect(assignableRoles(false)).toEqual(["docente"]);
    expect(assignableRoles(true)).toEqual(["docente", "admin", "superadmin"]);
  });
});

describe("rowActions", () => {
  const admin: ActionContext = { viewerId: ME, canSuspend: true, canGrant: true, canGrantPrivileged: false };
  const superadmin: ActionContext = { ...admin, canGrantPrivileged: true };

  it("offers nothing on the viewer's own account", () => {
    expect(rowActions({ user_id: ME, status: "active", roles: ["docente"] }, superadmin)).toEqual({
      own: true,
      suspend: false,
      reactivate: false,
      grantable: [],
      revocable: [],
    });
  });

  it("lets an admin suspend a docente and grant only the docente role", () => {
    const a = rowActions({ user_id: OTHER, status: "active", roles: [] }, admin);
    expect(a.suspend).toBe(true);
    expect(a.reactivate).toBe(false);
    expect(a.grantable).toEqual(["docente"]);
    expect(a.revocable).toEqual([]);
  });

  it("offers reactivation for a suspended account and no role grant", () => {
    const a = rowActions({ user_id: OTHER, status: "suspended", roles: ["docente"] }, admin);
    expect(a.reactivate).toBe(true);
    expect(a.suspend).toBe(false);
    expect(a.grantable).toEqual([]);
    expect(a.revocable).toEqual(["docente"]);
  });

  it("offers nothing on the status of an account pending deletion", () => {
    const a = rowActions({ user_id: OTHER, status: "deletion_pending", roles: ["docente"] }, superadmin);
    expect(a.suspend || a.reactivate).toBe(false);
  });

  it("hides status changes on admins from a plain admin but not from a superadmin", () => {
    const target = { user_id: OTHER, status: "active" as const, roles: ["docente", "admin"] };
    expect(rowActions(target, admin).suspend).toBe(false);
    expect(rowActions(target, admin).revocable).toEqual(["docente"]);
    expect(rowActions(target, superadmin).suspend).toBe(true);
    expect(rowActions(target, superadmin).revocable).toEqual(["docente", "admin"]);
  });

  it("lets a superadmin grant what the account still lacks, never blocked roles", () => {
    const a = rowActions({ user_id: OTHER, status: "active", roles: ["docente", "creador"] }, superadmin);
    expect(a.grantable).toEqual(["admin", "superadmin"]);
    expect(a.revocable).toEqual(["docente"]);
  });

  it("respects the missing permissions", () => {
    const readOnly: ActionContext = { viewerId: ME, canSuspend: false, canGrant: false, canGrantPrivileged: false };
    const a = rowActions({ user_id: OTHER, status: "active", roles: ["docente"] }, readOnly);
    expect(a).toEqual({ own: false, suspend: false, reactivate: false, grantable: [], revocable: [] });
  });
});

describe("helpers", () => {
  it("links to the audit of the user", () => {
    expect(auditLinkForUser(OTHER)).toBe(`/admin/auditoria?resource_type=user&resource_id=${OTHER}`);
  });

  it("formats dates in Lima time", () => {
    // 03:30 UTC is still the previous day in Lima (UTC-5).
    expect(formatLimaDate("2026-10-03T03:30:00Z")).toBe("02/10/2026");
    expect(formatLimaDate("2026-10-03T15:30:00Z")).toBe("03/10/2026");
    expect(formatLimaDate(null)).toBe("—");
    expect(formatLimaDate("no es fecha")).toBe("—");
  });
});
