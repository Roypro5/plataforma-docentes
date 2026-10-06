import { describe, expect, it } from "vitest";
import { es } from "./es";
import { adminAvisos } from "./es-admin-avisos";

// Everything the production build can show about the product. It must not talk about stages,
// the test environment, sandbox plans or the internal pages.
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const productionCopy: Record<string, unknown> = {
  homeProduct: es.homeProduct,
  principles: es.home.principles,
  footer: es.shell.footerProduct,
  notFound: es.shell.notFound.bodyProduct,
  meta: [es.meta.descriptionProduct, es.meta.ogDescriptionProduct],
  faq: es.ayuda.faqProduct,
  ayudaMeta: es.ayuda.metaDescriptionProduct,
  deletePoints: es.cuenta.eliminar.pointsProduct,
  emailRateLimit: es.cuenta.common.emailRateLimit,
  audienceHint: adminAvisos.form.audienceHintProduct,
};

const forbidden = /etapa|sandbox|de prueba|entorno de prueba|sistema visual|hoja de ruta|individual|demo\b|S\/\s?\d|fase futura/i;

describe("production copy", () => {
  for (const [name, value] of Object.entries(productionCopy)) {
    it(`${name} mentions no stage, test environment, sandbox or internal page`, () => {
      const texts = strings(value);
      expect(texts.length).toBeGreaterThan(0);
      for (const text of texts) expect(text, text).not.toMatch(forbidden);
    });
  }

  it("answers the payments question with a free platform and no paid plans", () => {
    const answer = es.ayuda.faqProduct.find((f) => f.q.includes("pagos"))?.a ?? "";
    expect(answer).toMatch(/gratuita/);
    expect(answer).toMatch(/no hay planes de pago/);
  });

  it("keeps the development FAQ answer about the sandbox plan separate", () => {
    const dev = es.ayuda.faq.find((f) => f.q.includes("pagos"))?.a ?? "";
    expect(dev).toMatch(/sandbox/);
  });

  it("has one production home entry per feature that exists today", () => {
    expect(es.homeProduct.today).toHaveLength(4);
  });
});
