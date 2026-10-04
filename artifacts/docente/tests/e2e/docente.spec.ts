import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// End-to-end flow of a teacher against a deployed environment (staging), with the sandbox gateway.
// Credentials of a test account (already registered, onboarding complete) come only from the
// environment: E2E_DOCENTE_EMAIL and E2E_DOCENTE_PASSWORD. The base URL comes from E2E_BASE_URL.
// The tests are serial and share one signed-in page. The purchase flow changes the state of that
// account, so it runs only in the desktop project; the accessibility checks run in both.
// Run with: pnpm --filter @workspace/docente test:e2e (see docs/runbooks/e2e-staging.md).

const email = process.env.E2E_DOCENTE_EMAIL;
const password = process.env.E2E_DOCENTE_PASSWORD;
const baseURL = process.env.E2E_BASE_URL;

test.describe.configure({ mode: "serial" });

test.describe("docente en staging", () => {
  test.skip(
    !email || !password || !baseURL,
    "Faltan E2E_BASE_URL, E2E_DOCENTE_EMAIL o E2E_DOCENTE_PASSWORD: define las tres variables (ver docs/runbooks/e2e-staging.md).",
  );

  let page: Page;
  let startedOnFree = false;

  test.beforeAll(async ({ browser }, testInfo) => {
    if (!email || !password || !baseURL) return;
    page = await newSignedOutPage(browser, testInfo.project.use.viewport ?? undefined);
  });

  // The page is created by hand, so the failure screenshot of the config does not apply to it.
  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus && page) {
      await testInfo.attach("pantalla", { body: await page.screenshot(), contentType: "image/png" });
    }
  });

  test.afterAll(async () => {
    await page?.context().close();
  });

  // Purchases and cancellations modify the account: only the desktop project does them.
  function desktopOnly() {
    test.skip(test.info().project.name !== "desktop", "El flujo de compra corre solo en el proyecto desktop para no duplicar pagos.");
  }

  test("1. ingreso y panel", async () => {
    await page.goto("/ingresar");
    try {
      await setPrivateValue(page.getByTestId("input-email"), email!);
      await setPrivateValue(page.getByTestId("input-password"), password!);
      await page.getByTestId("button-sign-in").click();
    } finally {
      // The form has already been submitted (or the step failed): clear the values so a failure
      // screenshot or report never contains them.
      await clearCredentialFields(page);
    }
    await expect(page, "La cuenta de prueba debe tener el registro (onboarding) completo").toHaveURL(/\/panel$/);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByTestId("list-modules")).toBeVisible();
  });

  test("2. interés en un módulo próximamente: registrar y retirar", async () => {
    desktopOnly();
    await page.goto("/panel");
    const toggle = page.locator('[data-testid^="button-interest-"]').first();
    await expect(toggle, "Debe haber un módulo «Próximamente» en el panel").toBeVisible();
    const testId = (await toggle.getAttribute("data-testid"))!;
    const initial = (await toggle.getAttribute("aria-pressed")) === "true";

    // Two clicks: the state changes and then returns to what it was, so the test is repeatable.
    await page.getByTestId(testId).click();
    await expect(page.getByTestId(testId)).toHaveAttribute("aria-pressed", String(!initial));
    await page.getByTestId(testId).click();
    await expect(page.getByTestId(testId)).toHaveAttribute("aria-pressed", String(initial));
  });

  test("3. checkout sandbox: rechazar y luego aprobar (solo si el plan es Gratis)", async () => {
    desktopOnly();
    const plan = await currentPlan(page);
    startedOnFree = plan === "gratis";
    test.info().annotations.push({ type: "plan inicial", description: plan });
    test.skip(!startedOnFree, "La cuenta ya tiene el plan Individual vigente: no se compra de nuevo.");

    // First attempt: rejected, the account stays on Gratis.
    await startCheckout(page);
    await page.getByTestId("button-sandbox-rejected").click();
    await expect(page).toHaveURL(/\/planes\/resultado\?pago=/);
    await expect(paymentStatus(page, "rejected")).toBeVisible();
    expect(await currentPlan(page)).toBe("gratis");

    // Second attempt: approved.
    await startCheckout(page);
    await page.getByTestId("button-sandbox-approved").click();
    await expect(page).toHaveURL(/\/planes\/resultado\?pago=/);
    await expect(paymentStatus(page, "approved")).toBeVisible();
  });

  test("4. el módulo demo queda disponible", async () => {
    desktopOnly();
    await page.goto("/modulos/demo");
    await expect(page.getByTestId("text-demo-access")).toHaveText("Acceso concedido por tu plan Individual (prueba)");
    await expect(page.getByTestId("section-module-blocked")).toHaveCount(0);
  });

  test("5. Mi plan: plan Individual, cancelar y reanudar", async () => {
    desktopOnly();
    expect(await currentPlan(page)).toBe("individual");

    // If a previous run left the cancellation on, restore it first so the test always starts the same way.
    if (await page.getByTestId("button-resume-subscription").isVisible()) {
      await page.getByTestId("button-resume-subscription").click();
      await expect(page.getByTestId("button-cancel-subscription")).toBeVisible();
    }

    await confirmable(page, "button-cancel-subscription");
    await expect(page.getByTestId("button-resume-subscription")).toBeVisible();
    // Cancelling keeps the access until the end of the period.
    await expect(page.getByTestId("text-cancels-on")).toBeVisible();
    await expect(page.getByTestId("text-current-plan-name")).toHaveText("Individual");

    await page.getByTestId("button-resume-subscription").click();
    await expect(page.getByTestId("button-cancel-subscription")).toBeVisible();
    await expect(page.getByTestId("button-resume-subscription")).toHaveCount(0);

    // The demo stays available after cancelling and resuming.
    await page.goto("/modulos/demo");
    await expect(page.getByTestId("text-demo-access")).toBeVisible();
  });

  for (const route of ["/planes", "/mi-plan", "/modulos/demo"]) {
    test(`6. accesibilidad de ${route}`, async () => {
      await page.goto(route);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("lang", "es-PE");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

async function newSignedOutPage(browser: Browser, viewport: { width: number; height: number } | undefined): Promise<Page> {
  const context = await browser.newContext({ baseURL, viewport });
  return context.newPage();
}

/**
 * Sets a field without `fill`: Playwright reports (and traces) print the argument of `fill`, and the
 * report is uploaded as an artifact. The login form is uncontrolled, so the value in the DOM is what is sent.
 */
async function setPrivateValue(field: Locator, value: string): Promise<void> {
  await expect(field).toBeVisible();
  await field.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    input.value = v;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

/** Empties the sign-in fields if they are still on the page. */
async function clearCredentialFields(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      for (const el of document.querySelectorAll<HTMLInputElement>("input[type=email], input[type=password]")) el.value = "";
    })
    .catch(() => {});
}

/** Plan shown by /mi-plan: "gratis" or "individual". */
async function currentPlan(page: Page): Promise<string> {
  await page.goto("/mi-plan");
  const el = page.getByTestId("text-current-plan-name");
  await expect(el).toBeVisible();
  return ((await el.textContent()) ?? "").trim().toLowerCase();
}

/** /planes -> checkout -> pasarela de prueba. The sandbox must be enabled in this environment. */
async function startCheckout(page: Page): Promise<void> {
  await page.goto("/planes");
  await expect(page.getByTestId("text-sandbox-off"), "El checkout sandbox debe estar habilitado en este entorno").toHaveCount(0);
  await page.getByTestId("link-choose-individual").click();
  await expect(page).toHaveURL(/\/planes\/checkout$/);
  await page.getByTestId("button-start-checkout").click();
  await expect(page).toHaveURL(/\/planes\/sandbox\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("section-sandbox")).toBeVisible();
}

/** Result page: shows the status read from the database, never from the URL. */
function paymentStatus(page: Page, status: string): Locator {
  return page.getByTestId(`section-result-${status}`);
}

/** Clicks a button that may ask for confirmation in a dialog first. */
async function confirmable(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).click();
  const confirm = page.getByTestId(`${testId}-confirm`);
  if (await confirm.isVisible({ timeout: 3_000 }).catch(() => false)) await confirm.click();
}
