import { test, expect } from "@playwright/test";

// STAGING mode (NEXT_PUBLIC_APP_ENV=staging, see playwright.config.ts): development and staging keep the
// project pages, the stage badge and the stage-oriented home. This guards that the production mode did not
// leak into them. The production counterpart is ../produccion.spec.ts.
test("staging keeps the internal pages, the stage badge and the stage home", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByTestId("link-nav-sistema")).toHaveCount(1);
  await expect(page.getByTestId("link-nav-ruta")).toHaveCount(1);
  await expect(page.getByTestId("link-mobile-sistema")).toHaveCount(1);
  await expect(page.getByTestId("link-mobile-ruta")).toHaveCount(1);
  await expect(page.getByTestId("link-cta-sistema")).toBeVisible();
  await expect(page.getByTestId("link-cta-ruta")).toBeVisible();
  await expect(page.getByText("Estado de la etapa 5")).toBeVisible();
  await expect(page.getByText("Lo que ves hoy es la etapa 5")).toBeVisible();
  await expect(page.getByTestId("link-cta-registro")).toHaveCount(0);

  if (testInfo.project.name === "staging-desktop") {
    await expect(page.getByText("Etapa 5 de 5 · Planes de prueba")).toBeVisible();
  } else {
    const columns = await page.getByRole("navigation", { name: "Navegación inferior" }).evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(5);
  }

  for (const route of ["/sistema", "/hoja-de-ruta"]) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
  }
});
