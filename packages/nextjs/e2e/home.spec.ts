import { test, expect } from "@playwright/test";

/**
 * Smoke E2E: la landing pública (sin sesión) renderiza el shell básico
 * y los enlaces a /login están presentes. NO requiere DB seedeada ni Hardhat,
 * pero SÍ requiere que `pnpm db:up` esté corriendo (Next hace fetch a /api/public/preview).
 */

test.describe("Landing pública", () => {
  test("renderiza el título y CTAs principales", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /Plataforma universitaria/i }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /Iniciar sesión/i }).first(),
    ).toBeVisible();
  });

  test("la página /login renderiza el formulario", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: /Iniciar sesión/i }),
    ).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(
      page.getByLabel("Contraseña", { exact: true }),
    ).toBeVisible();
  });

  test("404 personalizado se muestra en una ruta inexistente", async ({
    page,
  }) => {
    const response = await page.goto("/ruta-que-no-existe-12345");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: /Página no encontrada/i }),
    ).toBeVisible();
  });
});
