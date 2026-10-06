import { defineConfig, devices } from "@playwright/test";

// The app decides what it shows from NEXT_PUBLIC_APP_ENV, which Next inlines at BUILD time. The
// smoke suite therefore needs one build per mode:
//  - production (port 3000): the build that CI makes without the variable (fail-closed = production).
//    Specs in tests/smoke, except tests/smoke/staging.
//  - staging (port 3001): a second build of the same code with NEXT_PUBLIC_APP_ENV=staging, written to
//    its own folder (.next-staging) so it never overwrites the production one. Specs in tests/smoke/staging.
const STAGING_PORT = 3001;

export default defineConfig({
  testDir: "./tests/smoke",
  use: { trace: "retain-on-failure" },
  webServer: [
    {
      command: "pnpm exec next start --hostname 127.0.0.1 --port 3000",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: false,
    },
    {
      command: `pnpm exec next build && pnpm exec next start --hostname 127.0.0.1 --port ${STAGING_PORT}`,
      url: `http://127.0.0.1:${STAGING_PORT}`,
      env: { NEXT_PUBLIC_APP_ENV: "staging", NEXT_DIST_DIR: ".next-staging" },
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
  projects: [
    {
      name: "desktop",
      testIgnore: "**/staging/**",
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3000" },
    },
    {
      name: "mobile",
      testIgnore: "**/staging/**",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 }, baseURL: "http://127.0.0.1:3000" },
    },
    {
      name: "staging-desktop",
      testMatch: "**/staging/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${STAGING_PORT}` },
    },
    {
      name: "staging-mobile",
      testMatch: "**/staging/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 }, baseURL: `http://127.0.0.1:${STAGING_PORT}` },
    },
  ],
  reporter: [["list"], ["html", { open: "never" }]],
});
