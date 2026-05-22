/**
 * @file eslint.config.js
 * @description Configuración flat de ESLint para coco-app. Conserva las reglas
 * de estilo del cocowiki (semi, quotes, eqeqeq, no-var, jsdoc) y añade reglas
 * ESTRUCTURALES que protegen la arquitectura hexagonal con vertical slicing:
 *
 *   1. Solo `app/contexts/<slice>/infrastructure/` y `app/platform/db/` pueden
 *      importar `@prisma/client` o `~/platform/db/prisma.server`. Esto evita que
 *      la lógica de dominio dependa directamente del ORM.
 *
 *   2. Slices NO se importan entre sí por sus `infrastructure/`. Cross-slice
 *      solo está permitido por la API pública (`~/contexts/<slice>` sin sub-path
 *      o `~/contexts/<slice>/application/`).
 *
 *   3. Las rutas de RR (`app/routes/`) no pueden importar directamente de
 *      `infrastructure/` — deben pasar por `application/` (los use-cases).
 *
 *   4. Componentes UI (`app/shared/ui/`) no pueden importar de slices o platform
 *      (excepción: types compartidos).
 */

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import("eslint").Linter.Config[]} */
export default [
  // ─── Base: ignores ───────────────────────────────────────────────────────
  {
    ignores: [
      "node_modules/**",
      "build/**",
      ".react-router/**",
      "dist/**",
      "coverage/**",
      "prisma/migrations/**",
      "app/_legacy-*/**",
      "_legacy-*",
      "openapi/**",
      "cypress/**",
    ],
  },

  // ─── Reglas de estilo globales ──────────────────────────────────────────
  {
    files: ["**/*.{js,ts,tsx,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        globalThis: "readonly",
      },
    },
    rules: {
      "no-var": "warn",
      "prefer-const": "warn",
      eqeqeq: ["warn", "smart"],
      "no-console": ["warn", { allow: ["error", "warn", "info"] }],
      quotes: ["warn", "double", { avoidEscape: true, allowTemplateLiterals: true }],
      semi: ["error", "always"],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  // ─── Absolute path imports only — no `../../` cross-folder ─────────────
  // En coco-app TODO import cross-folder usa el alias `~/*`. Esto:
  //   - Hace el código robusto a refactors de carpetas (mover un slice no rompe imports).
  //   - Hace evidente cuando un archivo cruza el límite de su slice/layer.
  //   - Trabaja con la regla de no-fuga de Prisma (la regex pattern matchea bien).
  // Se permite `./X` (intra-folder) y `../X` (un solo nivel arriba, intra-package),
  // pero NO `../../X` o `../../../X`.
  {
    files: ["app/**/*.{js,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../*", "../../../*", "../../../../*"],
              message:
                "Imports cross-folder deben usar el alias absoluto `~/`. Ejemplo: `import { foo } from '~/platform/db/prisma.server'` en lugar de `'../../../platform/db/prisma.server'`.",
            },
          ],
        },
      ],
    },
  },

  // ─── Anti-fuga de Prisma ────────────────────────────────────────────────
  // @prisma/client y el cliente extendido solo deben usarse desde:
  //   - app/contexts/<slice>/infrastructure/**
  //   - app/platform/db/**
  //   - prisma/** (seeds, migrations helpers)
  //
  // Grandfathered (legacy services copiados del backend que aún usan prisma
  // inline en application/). Ver CLEANUP_PLAN.md para roadmap de extracción.
  // Cualquier archivo NUEVO en application/ que necesite prisma debe extraer
  // a un modelo en infrastructure/ antes de mergear.
  {
    files: ["app/**/*.{js,ts,tsx}"],
    ignores: [
      "app/contexts/*/infrastructure/**",
      "app/platform/db/**",
      // ── Legacy services grandfathered (heredan prisma inline del backend
      //    legacy). Refactor pendiente — extraer queries a infrastructure/.
      //    Lista completa con plan de refactor en CLEANUP_PLAN.md.
      //    Cualquier archivo nuevo en application/ que use prisma se rechaza.
      "app/contexts/accounts-payable/application/accountingExportService.js",
      "app/contexts/accounts-payable/application/anticipoPolizaLifecycleService.js",
      // approvals/approverResolver.js — REFACTORIZADO Fase 6.
      //   DI-style ya recibía `db` por parámetro; wrapper global movido a
      //   infrastructure/approverResolverGlobal.js.
      // notifications/notificationService.js — REFACTORIZADO Fase 6.
      //   prisma extraído a infrastructure/notificationModel.js.
      "app/contexts/onboarding/application/onboardingImportService.js",
      "app/contexts/organizations/application/organizationService.js",
      // organizations/tenantApplicantUserGrants.js — REFACTORIZADO Fase 6.
      // policies/employeeCategoryService.js — REFACTORIZADO Fase 6.
      "app/contexts/policies/application/policyService.js",
      // policies/policyAlertService.js — REFACTORIZADO Fase 6.
      // policies/viaticasPolicyService.js — REFACTORIZADO Fase 6.
      // policies/policyExceptionService.js — REFACTORIZADO Fase 6.
      // receipts-cfdi/comprobantesService.js — REFACTORIZADO Fase 6.
      // receipts-cfdi/receiptFileService.js — REFACTORIZADO Fase 6.
      // refunds/reimbursementTimeService.js — REFACTORIZADO Fase 6.
      // workflow/requestCommentService.js — REFACTORIZADO Fase 6.
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Prisma solo debe importarse desde `app/contexts/<slice>/infrastructure/` o `app/platform/db/`. Usa los use-cases del slice para tocar datos.",
            },
            {
              name: "~/platform/db/prisma.server",
              message:
                "El cliente Prisma solo se importa desde `infrastructure/` o desde otros archivos en `platform/db/`. Llama use-cases del slice.",
            },
          ],
          patterns: [
            {
              group: ["**/platform/db/prisma.server*"],
              message:
                "El cliente Prisma solo se importa desde `infrastructure/` o desde otros archivos en `platform/db/`.",
            },
          ],
        },
      ],
    },
  },

  // ─── Anti-fuga cross-slice por infrastructure ───────────────────────────
  // Slices no pueden importar `~/contexts/<other>/infrastructure/...` —
  // solo `~/contexts/<other>` (re-export en index.ts) o `~/contexts/<other>/application/...`.
  {
    files: ["app/contexts/**/*.{js,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["~/contexts/*/infrastructure/*", "../../*/infrastructure/*"],
              message:
                "No importes infrastructure de otro slice directamente. Usa la API pública del slice (`~/contexts/<slice>`) o sus use-cases (`~/contexts/<slice>/application/`).",
            },
          ],
        },
      ],
    },
  },

  // ─── Routes no importan infrastructure directamente ─────────────────────
  // Las routes deben llamar use-cases del slice, no repositorios crudos.
  {
    files: ["app/routes/**/*.{js,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["~/contexts/*/infrastructure/*", "../../**/infrastructure/*"],
              message:
                "Las rutas deben llamar a `application/<useCase>` del slice, no a `infrastructure/`.",
            },
            {
              group: ["@prisma/client"],
              message: "Prisma no se usa desde rutas; expone la operación como use-case del slice.",
            },
          ],
        },
      ],
    },
  },

  // ─── shared/ui no toca dominio ni platform ──────────────────────────────
  {
    files: ["app/shared/ui/**/*.{js,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["~/contexts/*", "../../**/contexts/*", "~/platform/*", "../../**/platform/*"],
              message:
                "Componentes UI compartidos no deben depender de slices ni platform; reciben datos por props.",
            },
          ],
        },
      ],
    },
  },

  // ─── Test files: más laxos ──────────────────────────────────────────────
  {
    files: ["tests/**/*.{js,ts,tsx}", "**/*.test.{js,ts,tsx}", "**/*.spec.{js,ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
      "no-console": "off",
    },
  },
];
