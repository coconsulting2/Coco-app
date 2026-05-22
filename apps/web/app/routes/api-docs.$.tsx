/**
 * @module api-docs.$
 * @description Resource route que sirve los 38 OpenAPI YAMLs + una página HTML
 * con Swagger UI cargado desde CDN. Réplica de `app.use("/api-docs", swaggerUi)`
 * del backend legacy.
 *
 * Rutas:
 *   GET /api-docs                     → HTML con Swagger UI (selector dual)
 *   GET /api-docs/swagger-m1.yaml     → YAML raw
 *   GET /api-docs/swagger-m2.yaml     → YAML raw
 *   GET /api-docs/<subpath>.yaml      → cualquier YAML de openapi/
 *
 * Justificación: el contrato OpenAPI documenta los endpoints `/api/*` que
 * preservamos para integraciones externas + componentes legacy. Es la fuente
 * de verdad del contrato HTTP.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LoaderFunctionArgs } from "react-router";

import { jsonError } from "~/platform/http/responses";

// __dirname-equivalent en ESM. El archivo vive en app/routes/api-docs.$.tsx,
// así que para llegar a /openapi (raíz del proyecto) hay que subir 2 niveles
// (routes/ → app/) y luego añadir /../openapi.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OPENAPI_DIR = path.resolve(__dirname, "..", "..", "openapi");

const SWAGGER_HTML = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>CocoConsulting API — Swagger UI</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css" />
    <style>
      body { margin: 0; background: #fafaf7; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          urls: [
            { url: "/api-docs/swagger-m1.yaml", name: "Módulo 1 — Core" },
            { url: "/api-docs/swagger-m2.yaml", name: "Módulo 2 — Admin & Workflow" },
          ],
          "urls.primaryName": "Módulo 1 — Core",
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis],
        });
      };
    </script>
  </body>
</html>`;

export async function loader({ request, params }: LoaderFunctionArgs) {
  const subpath = (params as { "*"?: string })["*"] ?? "";

  // GET /api-docs → HTML Swagger UI
  if (!subpath || subpath === "index.html") {
    return new Response(SWAGGER_HTML, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  // GET /api-docs/<file>.yaml → raw YAML
  if (subpath.endsWith(".yaml") || subpath.endsWith(".yml")) {
    // Resolver path absoluto y validar que no salga de OPENAPI_DIR (anti path traversal).
    const requested = path.resolve(OPENAPI_DIR, subpath);
    if (!requested.startsWith(OPENAPI_DIR + path.sep) && requested !== OPENAPI_DIR) {
      return jsonError(403, "Path traversal not allowed", "FORBIDDEN");
    }
    try {
      const yaml = await fs.promises.readFile(requested, "utf-8");
      return new Response(yaml, {
        status: 200,
        headers: {
          "content-type": "application/yaml; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === "ENOENT") {
        return jsonError(404, `OpenAPI spec not found: ${subpath}`, "SPEC_NOT_FOUND");
      }
      return jsonError(500, "Error reading OpenAPI spec", "READ_ERROR");
    }
  }

  return jsonError(404, `Unknown /api-docs path: ${subpath}`, "UNKNOWN_PATH");
}

export async function action() {
  return jsonError(405, "Method not allowed", "METHOD_NOT_ALLOWED");
}
