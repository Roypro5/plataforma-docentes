import { describe, expect, it } from "vitest";
import { adminSectionsFor } from "./sections";

describe("adminSectionsFor", () => {
  it("lists the billing section only when billing is on", () => {
    expect(adminSectionsFor({ billing: true }).map((s) => s.key)).toContain("planes-pagos");
    expect(adminSectionsFor({ billing: false }).map((s) => s.key)).not.toContain("planes-pagos");
  });

  it("keeps the seven other sections in both modes", () => {
    const on = adminSectionsFor({ billing: true }).filter((s) => s.key !== "planes-pagos");
    const off = adminSectionsFor({ billing: false });
    expect(off).toEqual(on);
    expect(off.map((s) => s.key)).toEqual([
      "usuarios", "modulos", "avisos", "catalogos", "organizaciones", "metricas", "auditoria",
    ]);
  });
});
