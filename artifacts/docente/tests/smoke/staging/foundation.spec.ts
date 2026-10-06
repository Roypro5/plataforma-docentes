import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("foundation routes, accessibility and mobile width", async ({ page }) => {
  for (const route of ["/", "/sistema", "/ayuda", "/hoja-de-ruta"]) {
    await page.goto(route);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("html")).toHaveAttribute("lang", "es-PE");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
  }
});