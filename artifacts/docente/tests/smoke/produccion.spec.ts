import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// PRODUCTION mode: the build CI makes without NEXT_PUBLIC_APP_ENV (unset = production, fail-closed).
// Decisions 2 and 7 of the launch plan: no payments, no internal project pages, no stage information.
// The staging counterpart (the same pages as they exist in development and staging) is in ./staging.

const SANDBOX_ID = "3f2b1c0e-8a4d-4c1e-9b7a-2d5e6f7a8b9c";

test("the product home and help pages are accessible at any width", async ({ page }) => {
  for (const route of ["/", "/ayuda"]) {
    await page.goto(route);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("html")).toHaveAttribute("lang", "es-PE");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations).toEqual([]);
  }
});

test("the home describes the product, not the project", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("list-home-today").locator("li")).toHaveCount(4);
  await expect(page.getByTestId("list-home-planned").locator("li")).toHaveCount(4);

  // No stage status, roadmap, system page link or test notice anywhere on the page.
  const body = page.locator("body");
  await expect(body).not.toContainText(/etapa \d/i);
  await expect(body).not.toContainText(/hoja de ruta/i);
  await expect(body).not.toContainText(/sistema visual/i);
  await expect(body).not.toContainText(/no uses datos personales reales/i);
  await expect(page.locator('a[href="/sistema"], a[href="/hoja-de-ruta"], a[href="/planes"], a[href="/mi-plan"]')).toHaveCount(0);

  await expect(page.getByTestId("link-cta-registro")).toHaveAttribute("href", "/registro");
  await expect(page.getByTestId("link-cta-ingresar")).toHaveAttribute("href", "/ingresar");
  await page.getByTestId("link-cta-registro").click();
  await expect(page).toHaveURL(/\/registro$/);
});

test("navigation has no internal pages and the layout has no stage badge", async ({ page }, testInfo) => {
  for (const route of ["/", "/ayuda", "/ingresar"]) {
    await page.goto(route);
    for (const key of ["sistema", "ruta"]) {
      await expect(page.getByTestId(`link-nav-${key}`)).toHaveCount(0);
      await expect(page.getByTestId(`link-mobile-${key}`)).toHaveCount(0);
    }
    for (const key of ["inicio", "ayuda", "panel"]) {
      await expect(page.getByTestId(`link-nav-${key}`)).toHaveCount(1);
      await expect(page.getByTestId(`link-mobile-${key}`)).toHaveCount(1);
    }
    await expect(page.locator("body")).not.toContainText(/etapa \d de \d/i);
    await expect(page.locator("body")).not.toContainText(/entorno de prueba/i);
  }

  if (testInfo.project.name === "mobile") {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Navegación inferior" });
    await expect(nav.getByRole("link")).toHaveCount(3);
    // Three items, three columns: the bar fills the width without an empty slot.
    const columns = await nav.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("internal and billing pages answer 404 and never redirect to sign in", async ({ page }) => {
  const routes = [
    "/sistema",
    "/hoja-de-ruta",
    "/planes",
    "/planes/checkout",
    "/planes/resultado",
    `/planes/sandbox/${SANDBOX_ID}`,
    "/mi-plan",
    "/admin/planes-pagos",
  ];
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(404);
    expect(new URL(page.url()).pathname, route).toBe(route);
    await expect(page.locator("h1"), route).toHaveText("Esta página no existe");
  }
});

test("the payments answer in the help page says the platform is free", async ({ page }) => {
  await page.goto("/ayuda");
  await page.getByText("¿Hay pagos o suscripciones?").click();
  await expect(page.getByText("no hay planes de pago")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/sandbox|S\/\s?\d/i);
});

test("the 404 page is accessible and has no demo wording", async ({ page }) => {
  await page.goto("/planes");
  await expect(page.locator("body")).not.toContainText(/demostraci/i);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
});
