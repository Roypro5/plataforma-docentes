import { test, expect } from "@playwright/test";

// Runs against the STAGING-mode build (see playwright.config.ts). In production these pages answer 404:
// see ../produccion.spec.ts.
// CI has no Supabase project: the stage 5 pages (plans, checkout, my plan, billing admin) are
// private and must redirect to sign in. The signed-in flow lives in tests/e2e (staging only).
test("plans, my plan and billing admin require sign-in", async ({ page }) => {
  for (const route of ["/planes", "/planes/checkout", "/planes/resultado", "/mi-plan", "/admin/planes-pagos"]) {
    const response = await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`/ingresar\\?next=${encodeURIComponent(route)}$`));
    expect(response?.ok()).toBe(true);
  }
});
