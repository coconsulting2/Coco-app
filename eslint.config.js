/**
 * @file eslint.config.js (workspace root)
 * @description Configuración flat ESLint para el monorepo coco-app. Aplica
 * reglas estructurales que protegen la arquitectura hexagonal con vertical
 * slicing y los límites entre packages:
 *
 *   1. Solo `packages/db/**` puede importar `@prisma/client`.
 *   2. Solo `apps/web/app/contexts/<slice>/infrastructure/` y `packages/db/**`
 *      pueden importar el cliente Prisma vía `@coco/db`.
 *   3. Slices NO se importan entre sí por sus `infrastructure/`. Cross-slice
 *      solo está permitido por la API pública (`~/contexts/<slice>`).
 *   4. Routes (`apps/web/app/routes/`) no importan directamente de
 *      `infrastructure/` — deben pasar por `application/` (use-cases).
 *   5. `apps/web/app/shared/ui/**` no toca slices ni platform ni packages
 *      excepto `@coco/ui-kit`.
 *   6. `apps/web/app/routes/_app/**` y `apps/web/app/shared/ui/**` NO pueden
 *      llamar `apiRequest` ni `fetch('/api/...')` — toda data interna pasa por
 *      loaders/actions de RR7.
 *   7. `packages/ui-kit/**` no toca apps/* ni packages/{db,contracts,scheduler,integrations}.
 */

/** @type {import("eslint").Linter.Config[]} */
export default [
  // ─── Base: ignores ───────────────────────────────────────────────────────
  {
    ignores: [
      "**/node_modules/**",
      "**/build/**",
      "**/.react-router/**",
      "**/dist/**",
      "**/coverage/**",
      "packages/db/prisma/migrations/**",
      "apps/web/app/_legacy-*/**",
      "**/_legacy-*",
      "apps/web/openapi/**",
      "apps/web/cypress/**",
      "packages/contracts/src/m1.ts",
      "packages/contracts/src/m2.ts",
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
      "no-var": "error",
      "prefer-const": "warn",
      eqeqeq: ["warn", "smart"],
      "no-console": ["warn", { allow: ["error", "warn", "info"] }],
      quotes: ["warn", "double", { avoidEscape: true, allowTemplateLiterals: true }],
      semi: ["error", "always"],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  // ─── Imports ABSOLUTOS puros en apps/web/app ─────────────────────────────
  // Prohibido cualquier `./X` o `../X`. Todo usa `~/...` (apps/web/app),
  // `@coco/*` (workspace packages), o paquetes npm. Esto hace los archivos
  // robustos a refactors de carpetas y obvio cuando un archivo cruza límites.
  {
    files: ["apps/web/app/**/*.{js,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["./*", "../*", "../../*", "../../../*", "../../../../*"],
              message:
                "Imports relativos prohibidos en apps/web/app. Usa `~/...` para archivos internos del web app o `@coco/*` para workspace packages.",
            },
          ],
        },
      ],
    },
  },

  // ─── Imports ABSOLUTOS puros en packages/*/src ───────────────────────────
  // Mismo principio que apps/web: nada de `./X` ni `../X`. Cada package
  // expone un internal alias `#/*` que apunta a su `./src/*` (vía
  // `package.json#imports`). Cross-package usa `@coco/*`.
  {
    files: ["packages/*/src/**/*.{js,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["./*", "../*", "../../*", "../../../*", "../../../../*"],
              message:
                "Imports relativos prohibidos en packages/*/src. Usa el alias interno `#/...` (definido en package.json#imports) o `@coco/*` para cross-package.",
            },
          ],
        },
      ],
    },
  },

  // ─── Anti-fuga de Prisma ────────────────────────────────────────────────
  // @prisma/client SOLO se importa desde packages/db/**.
  // El cliente y tenant context se exponen vía @coco/db.
  {
    files: ["**/*.{js,ts,tsx}"],
    ignores: ["packages/db/**", "packages/scheduler/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Prisma solo se importa desde `packages/db/**`. Usa `@coco/db` o use-cases del slice.",
            },
          ],
        },
      ],
    },
  },

  // ─── Routes/UI no pueden tocar @coco/db directamente ────────────────────
  // apps/web/app/routes deben llamar use-cases del slice o servicios.
  // apps/web/app/shared/ui no toca datos.
  {
    files: ["apps/web/app/routes/**/*.{js,ts,tsx}", "apps/web/app/shared/ui/**/*.{js,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@coco/db",
              message:
                "Routes y shared/ui no consumen `@coco/db` directo. Llama un use-case del slice (`~/contexts/<slice>`).",
            },
            {
              name: "@prisma/client",
              message: "Prisma no se usa fuera de packages/db/**.",
            },
          ],
        },
      ],
    },
  },

  // ─── Anti-fuga cross-slice por infrastructure ───────────────────────────
  {
    files: ["apps/web/app/contexts/**/*.{js,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/contexts/*/infrastructure/*"],
              message:
                "No importes infrastructure de otro slice directo. Usa `~/contexts/<slice>` o `~/contexts/<slice>/application/`.",
            },
          ],
        },
      ],
    },
  },

  // ─── Routes no importan infrastructure directamente ─────────────────────
  {
    files: ["apps/web/app/routes/**/*.{js,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/contexts/*/infrastructure/*"],
              message: "Las rutas llaman use-cases (`application/`) del slice, no `infrastructure/`.",
            },
          ],
        },
      ],
    },
  },

  // ─── shared/ui no toca dominio ni platform ──────────────────────────────
  {
    files: ["apps/web/app/shared/ui/**/*.{js,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["~/contexts/*", "~/platform/*"],
              message:
                "Shared UI no depende de slices ni platform; recibe datos por props. Para átomos puros usa `@coco/ui-kit`.",
            },
          ],
        },
      ],
    },
  },

  // ─── No fetch interno a /api/* desde _app o shared/ui ────────────────────
  // Toda data interna del web app pasa por loaders/actions de RR7.
  {
    files: ["apps/web/app/routes/_app/**/*.{js,ts,tsx}", "apps/web/app/shared/ui/**/*.{js,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/utils/apiClient*", "@utils/apiClient"],
              message:
                "Páginas internas y shared/ui no consumen el propio `/api/*`. Mueve el fetch al loader/action de la ruta.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='fetch'][arguments.0.value=/^\\/api\\//]",
          message: "No llames `/api/*` desde el cliente; usa loader/action de RR7.",
        },
      ],
    },
  },

  // ─── packages/ui-kit no toca apps ni otros packages que no sean tipos ───
  {
    files: ["packages/ui-kit/**/*.{js,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@coco/db", "@coco/contracts", "@coco/integrations", "@coco/scheduler"],
              message:
                "`@coco/ui-kit` solo depende de React + Tailwind. No conoce dominio, datos ni integraciones.",
            },
            {
              group: ["**/apps/**"],
              message: "`@coco/ui-kit` no importa código de `apps/*`. Es upstream.",
            },
          ],
        },
      ],
    },
  },

  // ─── Test files: más laxos ──────────────────────────────────────────────
  {
    files: [
      "apps/web/tests/**/*.{js,ts,tsx}",
      "**/*.test.{js,ts,tsx}",
      "**/*.spec.{js,ts,tsx}",
      "packages/**/test/**/*.{js,ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": "off",
      "no-console": "off",
      "no-restricted-syntax": "off",
    },
  },
];
