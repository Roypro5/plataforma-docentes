import { test, expect } from "@playwright/test";

// CI has no Supabase project: private pages must redirect to sign in, and the PWA manifest
// and its icons must be public, static and free of redirects.
test("panel, notifications and module pages require sign-in", async ({ page }) => {
  for (const route of ["/panel", "/notificaciones", "/modulos/demo"]) {
    const response = await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`/ingresar\\?next=${encodeURIComponent(route)}$`));
    expect(response?.ok()).toBe(true);
  }
});

test("PWA manifest points at the panel and its icons are public PNG files", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest.start_url).toBe("/panel");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

  for (const icon of manifest.icons as { src: string; type: string }[]) {
    const res = await request.get(icon.src, { maxRedirects: 0 });
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()["content-type"], icon.src).toContain("image/png");
  }
});
