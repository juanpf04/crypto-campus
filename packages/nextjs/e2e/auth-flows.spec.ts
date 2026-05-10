import { test, expect } from "@playwright/test";

/**
 * Flujos E2E que requieren DB seedeada + Hardhat arrancado + contratos
 * desplegados. Marcados como `skip` por defecto para que la suite básica
 * pueda correr en CI sin esa infraestructura.
 *
 * Para activarlos:
 *   1. `pnpm db:up && pnpm db:reset && pnpm db:seed`
 *   2. `pnpm dev:hardhat` (en otro terminal — levanta nodo + deploy + Next)
 *   3. `RUN_E2E_FULL=1 pnpm exec playwright test`
 *
 * Las credenciales esperadas vienen de los seeds:
 *   - admin@ucm.es / Admin^12 (seed-admin.mjs)
 *   - alumno01@ucm.es / Admin^12 (seed-academic.mjs)
 *
 * Si los seeds han cambiado, ajustar abajo.
 */

const RUN_FULL = process.env.RUN_E2E_FULL === "1";
const fullTest = RUN_FULL ? test : test.skip;

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@ucm.es";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Admin^12";
const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL ?? "alumno01@ucm.es";
const STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD ?? "Admin^12";

test.describe("Flujos completos (requieren DB + Hardhat)", () => {
  fullTest("login admin y acceso al dashboard de admin", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(ADMIN_EMAIL);
    await page.getByLabel("Contraseña", { exact: true }).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /iniciar sesión/i }).click();

    await page.waitForURL(/\/admin/);
    await expect(page).toHaveURL(/\/admin/);
  });

  fullTest("login estudiante y ver tienda", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(STUDENT_EMAIL);
    await page.getByLabel("Contraseña", { exact: true }).fill(STUDENT_PASSWORD);
    await page.getByRole("button", { name: /iniciar sesión/i }).click();

    await page.waitForURL(/\/student/);
    await page.goto("/student/shop");
    // El hub de tienda del alumno usa "Catálogo" como sectionTitle visible.
    await expect(
      page.getByRole("heading", { name: /cat[áa]logo/i }).first(),
    ).toBeVisible();
  });

  fullTest("returnUrl genérico se resuelve al path real del rol", async ({
    page,
  }) => {
    // returnUrl=/printing debe resolver a /student/library/printing tras login.
    await page.goto("/login?returnUrl=/printing");
    await page.getByLabel("Email", { exact: true }).fill(STUDENT_EMAIL);
    await page.getByLabel("Contraseña", { exact: true }).fill(STUDENT_PASSWORD);
    await page.getByRole("button", { name: /iniciar sesión/i }).click();

    await page.waitForURL(/\/student\/library\/printing/);
    await expect(page).toHaveURL(/\/student\/library\/printing/);
  });
});
