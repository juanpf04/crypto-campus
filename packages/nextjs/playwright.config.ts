import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config para tests E2E de CryptoCampus.
 *
 * Requisitos para ejecutar la suite completa:
 *   - DB Postgres levantada (`pnpm db:up`) y seedeada (`pnpm db:seed`).
 *   - Hardhat node arrancado y contratos desplegados.
 *
 * Para un smoke check rápido sin Hardhat/DB usa solo `e2e/home.spec.ts`,
 * que renderiza la landing pública sin requerir auth.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
