/**
 * @module vitest.config
 * @description Configuración Vitest para tests unitarios (frontend + backend
 * services) ejecutándose contra el código de coco-app. Resuelve el alias `~/*`
 * a `app/*` igual que Vite + tsconfig.
 *
 * Los tests e2e (`*.e2e.test.*`) requieren BD viva — quedan excluidos del run
 * default. Para correr e2e: `bun run test:e2e:integration`.
 */
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "~": resolve(__dirname, "app"),
      "@coco/ui-kit": resolve(__dirname, "../../packages/ui-kit/src"),
      "@": resolve(__dirname, "app/shared"),
      "@tests": resolve(__dirname, "tests"),
      "@components": resolve(__dirname, "app/shared/ui"),
      "@utils": resolve(__dirname, "app/shared/utils"),
      "@config": resolve(__dirname, "app/shared/config"),
      "@type": resolve(__dirname, "app/shared/types"),
      "@layouts": resolve(__dirname, "app/shared/layouts"),
      "@data": resolve(__dirname, "app/shared/data"),
      "@stores": resolve(__dirname, "app/shared/stores"),
      "@assets": resolve(__dirname, "app/shared/assets"),
      "@styles": resolve(__dirname, "app/shared/styles"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    // Los component tests legacy que aún consumen `fetch(PUBLIC_API_BASE_URL/...)`
    // (p.ej. ResumenTramos) esperan que la base apunte al host mockeado por MSW.
    env: {
      PUBLIC_API_BASE_URL: "https://localhost:3000/api",
    },
    setupFiles: ["./tests/frontend/setup.ts"],
    include: [
      "tests/**/*.{test,spec}.{js,ts,tsx}",
    ],
    exclude: [
      "node_modules/**",
      "build/**",
      ".react-router/**",
      "cypress/**",
      // E2E tests need real DB + HTTPS server. Run separately.
      "**/*.e2e.test.*",
      // Legacy TC3005B backend tests are Jest (@jest/globals) + need a live DB;
      // they are not wired for this Vitest runner. Migrate or remove separately.
      "tests/backend/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["app/contexts/**/*.{js,ts}", "app/platform/**/*.{js,ts}"],
      exclude: [
        "app/contexts/**/infrastructure/**",  // adapters use real Prisma; cover via integration
        "**/*.test.*",
      ],
    },
  },
});
