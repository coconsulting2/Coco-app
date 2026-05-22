#!/usr/bin/env bun
/**
 * @module @coco/contracts/scripts/generate
 * @description Genera tipos TypeScript a partir de los Swagger YAML del
 * contrato público (Módulos M1 y M2). Lee desde `apps/web/openapi/swagger-*.yaml`
 * y escribe a `packages/contracts/src/{m1,m2}.ts`.
 *
 * Uso:
 *   bun --filter @coco/contracts generate
 *   (o desde packages/contracts: bun run generate)
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import openapiTS, { astToString } from "openapi-typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const repoRoot = resolve(packageRoot, "../..");

const specs: Array<{ src: string; out: string; label: string }> = [
  {
    src: resolve(repoRoot, "apps/web/openapi/swagger-m1.yaml"),
    out: resolve(packageRoot, "src/m1.ts"),
    label: "M1",
  },
  {
    src: resolve(repoRoot, "apps/web/openapi/swagger-m2.yaml"),
    out: resolve(packageRoot, "src/m2.ts"),
    label: "M2",
  },
];

const BANNER = `// AUTO-GENERATED FILE. DO NOT EDIT.
// Regenerate via: bun --filter @coco/contracts generate
// Source: apps/web/openapi/swagger-*.yaml
`;

async function generate(): Promise<void> {
  for (const spec of specs) {
    process.stdout.write(`[contracts] Generating ${spec.label} from ${spec.src} ... `);
    const ast = await openapiTS(new URL(`file://${spec.src}`), {
      alphabetize: true,
      arrayLength: false,
      excludeDeprecated: false,
      defaultNonNullable: true,
      enum: false,
    });
    const ts = BANNER + astToString(ast);
    await writeFile(spec.out, ts, "utf8");
    process.stdout.write(`✓ wrote ${spec.out}\n`);
  }
}

generate().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[contracts] generate failed:", err);
  process.exit(1);
});
