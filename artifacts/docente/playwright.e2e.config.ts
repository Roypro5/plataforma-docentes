import { defineConfig, devices } from "@playwright/test";

// End-to-end suite against a deployed environment (staging). It never starts a server: the base URL,
// the e-mail and the password of the test teacher account come from the environment, never from the repo.
// The smoke suite (playwright.config.ts, tests/smoke) does not pick these tests up: its testDir is different.

// A failing test would otherwise copy an accessibility snapshot of the page, input values included,
// into error-context.md and the report.
process.env.PLAYWRIGHT_NO_COPY_PROMPT ??= "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // One worker and serial files: the purchase flow changes the state of one real staging account.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  // No trace: it would record the values typed into the sign-in form, and reports are uploaded as artifacts.
  use: { baseURL: process.env.E2E_BASE_URL, trace: "off", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } } },
  ],
  reporter: [["list"], ["html", { open: "never" }]],
});
