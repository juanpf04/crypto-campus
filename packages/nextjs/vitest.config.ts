import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      // Coverage acotado a la lógica pura cubierta por vitest:
      // utilidades, hooks puros, tipos y atoms presentacionales.
      // El resto (server actions, infra, pages, organismos complejos) se
      // cubre mediante los 393 tests on-chain (Hardhat+Foundry) y los E2E
      // de Playwright — no por unit tests.
      include: [
        "src/lib/validators.ts",
        "src/lib/formatters.ts",
        "src/lib/utils.ts",
        "src/lib/shop-utils.ts",
        "src/lib/historical.ts",
        "src/hooks/useForm.ts",
        "src/types/index.ts",
        "src/components/ui/Button.tsx",
        "src/components/ui/EmptyState.tsx",
        "src/components/ui/SearchInput.tsx",
      ],
      exclude: ["src/**/*.{test,spec}.{ts,tsx}"],
    },
  },
});
