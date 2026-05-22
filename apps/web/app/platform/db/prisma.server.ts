/**
 * @module prisma.server (apps/web)
 * @description Composición del Prisma client específica del web app:
 *
 *   prismaBase (de @coco/db) ──► triggerExtension (dominio web) ──► tenantExtension (de @coco/db)
 *
 * Orden importante: tenant es la capa MÁS externa para que toda llamada del
 * caller pase primero por scoping multi-tenant; el trigger corre sobre los args
 * ya filtrados.
 *
 * En test (`PRISMA_DISABLE_TRIGGERS=true`) se omite el triggerExtension para
 * permitir fixtures sin side-effects.
 */
import { prismaBase, tenantExtension } from "@coco/db";
import { triggerExtension } from "~/platform/db/trigger-extension.server.js";

const disable_triggers =
  process.env.PRISMA_DISABLE_TRIGGERS === "true" &&
  process.env.NODE_ENV === "test";

type GlobalForPrisma = typeof globalThis & {
  __cocoWebPrisma?: ReturnType<typeof buildWebClient>;
};

function buildWebClient() {
  const base = disable_triggers
    ? prismaBase
    : prismaBase.$extends(triggerExtension);
  return base.$extends(tenantExtension);
}

const globalForPrisma = globalThis as GlobalForPrisma;

const prisma = globalForPrisma.__cocoWebPrisma ?? buildWebClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__cocoWebPrisma = prisma;
}

export { prisma };
export default prisma;

// Re-exports de conveniencia para los archivos infrastructure/* que aún
// importan helpers desde `~/platform/db/prisma.server`. Después de M8 (todo
// .js → .ts) los call-sites pueden importar directo de @coco/db.
export {
  connectPostgres,
  disconnectPostgres,
  resetPostgres,
} from "@coco/db";
