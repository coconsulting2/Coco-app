/**
 * @module @coco/db/client
 * @description Singleton Prisma client. Expone:
 *   - `prismaBase`: raw client sin extensiones — para composición avanzada
 *     (apps/web aplica trigger-extension de dominio encima).
 *   - `prisma`: client con tenant-extension aplicada — usable directo desde
 *     workers, CLIs, scripts.
 *
 * En dev con HMR/watch, guardamos la instancia en globalThis para no crear
 * múltiples PrismaClient en cada reload (cada uno con su pool).
 */
import { PrismaClient } from "@prisma/client";
import { tenantExtension } from "#/tenant-extension.js";

type GlobalForPrisma = typeof globalThis & {
  __cocoPrismaBase?: PrismaClient;
};

const globalForPrisma = globalThis as GlobalForPrisma;

export const prismaBase: PrismaClient =
  globalForPrisma.__cocoPrismaBase ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__cocoPrismaBase = prismaBase;
}

/** Client extendido con tenant scoping. Default para consumidores no-web. */
export const prisma = prismaBase.$extends(tenantExtension);

export type ExtendedPrismaClient = typeof prisma;

export async function connectPostgres(): Promise<void> {
  await prismaBase.$connect();
  // eslint-disable-next-line no-console
  console.info("Connected to PostgreSQL via Prisma");
}

export async function disconnectPostgres(): Promise<void> {
  await prismaBase.$disconnect();
}

export async function resetPostgres(): Promise<void> {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("resetPostgres llamado fuera de entorno de test");
  }
  const tables = await prismaBase.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;
  if (!tables.length) return;
  const tableList = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prismaBase.$queryRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
  );
}
