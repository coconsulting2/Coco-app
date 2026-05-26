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

/** Tipo del cliente Prisma EXTENDIDO del web app (trigger + tenant). */
export type WebPrismaClient = typeof prisma;

/**
 * Cliente disponible dentro de `prisma.$transaction(async (tx) => ...)`: el
 * client extendido menos los métodos no disponibles en una tx interactiva
 * (ITXClientDenyList). El client completo `prisma` es asignable a este tipo
 * (tiene todos los delegates), de modo que helpers tipados con
 * `Pick<WebTransactionClient, "...">` aceptan tanto el client completo como un
 * `tx` de transacción.
 */
export type WebTransactionClient = Omit<
  WebPrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// Re-exports de conveniencia para los archivos infrastructure/* que aún
// importan helpers desde `~/platform/db/prisma.server`. Después de M8 (todo
// .js → .ts) los call-sites pueden importar directo de @coco/db.
export {
  connectPostgres,
  disconnectPostgres,
  resetPostgres,
} from "@coco/db";
