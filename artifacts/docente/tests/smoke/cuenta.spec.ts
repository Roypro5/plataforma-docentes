import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// CI has no Supabase project: these pages must render an explicit "not configured"
// state, stay accessible at 360 px, and never expose private areas.
test("account pages are accessible and private areas require sign-in", async ({ page }) => {
  for (const route of ["/ingresar", "/registro", "/recuperar", "/restablecer", "/legal"]) {
    await page.goto(route);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("html")).toHaveAttribute("lang", "es-PE");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
  }

  for (const route of ["/perfil", "/perfil/eliminar", "/bienvenida", "/admin", "/admin/mfa", "/cuenta-suspendida"]) {
    const response = await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`/ingresar\\?next=${encodeURIComponent(route)}$`));
    expect(response?.ok()).toBe(true);
  }
});

test("auth callback without a valid code never opens a session", async ({ page }) => {
  await page.goto("/api/v1/auth/callback?code=invalido&next=//evil.test");
  await expect(page).toHaveURL(/\/ingresar\?error=enlace$/);
});
