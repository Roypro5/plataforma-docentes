import { describe, expect, it } from "vitest";
import { notificationContent, safeInternalPath } from "./notification-text";
import { resolveModuleViews, type ModuleRow } from "./views";

const row = (module_id: string, access: string, sort_order = 0, interested = false): ModuleRow => ({ module_id, access, sort_order, interested });

describe("resolveModuleViews", () => {
  it("drops ids the code does not know and states it does not recognize", () => {
    const views = resolveModuleViews([row("biblioteca", "coming_soon", 20), row("nuevo-modulo", "available", 5), row("marketplace", "weird", 30)], "production");
    expect(views.map((v) => v.id)).toEqual(["biblioteca"]);
  });

  it("never lets the hidden state through", () => {
    expect(resolveModuleViews([row("biblioteca", "hidden")], "development")).toEqual([]);
  });

  it("hides the dev-only demo in production and keeps it elsewhere", () => {
    const rows = [row("demo", "requires_entitlement", 50), row("biblioteca", "coming_soon", 20)];
    expect(resolveModuleViews(rows, "production").map((v) => v.id)).toEqual(["biblioteca"]);
    expect(resolveModuleViews(rows, "staging").map((v) => v.id)).toEqual(["biblioteca", "demo"]);
  });

  it("orders by sort_order and keeps the interest flag", () => {
    const views = resolveModuleViews([row("marketplace", "coming_soon", 30, true), row("generador-ia", "disabled", 10)], "production");
    expect(views.map((v) => [v.id, v.access, v.interested])).toEqual([
      ["generador-ia", "disabled", false],
      ["marketplace", "coming_soon", true],
    ]);
  });
});

describe("notificationContent", () => {
  it("uses the welcome template with the display name", () => {
    const c = notificationContent({ kind: "welcome", title: "db", body: "db", link_path: "/panel" }, " Ana ");
    expect(c.title).toBe("Te damos la bienvenida, Ana");
    expect(c.href).toBe("/panel");
  });

  it("resolves the module name for module_available and falls back to the stored text otherwise", () => {
    const known = notificationContent({ kind: "module_available", title: "db", body: "db", link_path: "/modulos/biblioteca" }, null);
    expect(known.title).toBe("Ya está disponible: Biblioteca personal");
    const unknown = notificationContent({ kind: "module_available", title: "Título BD", body: "Cuerpo BD", link_path: "/modulos/otro" }, null);
    expect([unknown.title, unknown.body]).toEqual(["Título BD", "Cuerpo BD"]);
    const other = notificationContent({ kind: "futuro", title: "T", body: "B", link_path: "/panel" }, null);
    expect([other.title, other.body]).toEqual(["T", "B"]);
  });
});

describe("safeInternalPath", () => {
  it("accepts internal paths only", () => {
    expect(safeInternalPath("/modulos/demo")).toBe("/modulos/demo");
    for (const bad of ["//evil.test", "https://evil.test", "javascript:alert(1)", "/a//b", "/Mayus", ""]) {
      expect(safeInternalPath(bad)).toBe("/panel");
    }
  });
});
