/**
 * @module prisma.server
 * @description Singleton Prisma client con trigger-extension (réplica de triggers
 * MariaDB legacy) + tenant-extension (RLS auto-inject) aplicados en orden:
 * triggers primero (para que su side-effect respete orgId), tenant scoping al final.
 *
 * Equivalente a database/config/prisma.js del backend legacy. La diferencia
 * estructural: vive en app/platform/db/ y se importa con ~/platform/db/prisma.server
 * desde loaders/actions o desde slices contexts/<slice>/infrastructure/.
 *
 * En dev con HMR, Vite reinicia módulos — guardamos la instancia en globalThis
 * para no crear múltiples PrismaClient en cada reload (cada uno con su pool).
 */
import { PrismaClient } from "@prisma/client";
import { triggerExtension } from "./trigger-extension.server.js";
import { tenantExtension } from "./tenant-extension.server.js";

const disable_triggers =
  process.env.PRISMA_DISABLE_TRIGGERS === "true" &&
  process.env.NODE_ENV === "test";

/**
 * @returns {import("@prisma/client").PrismaClient}
 */
function buildExtendedClient() {
  const client = new PrismaClient();
  let extended = disable_triggers ? client : client.$extends(triggerExtension);
  extended = extended.$extends(tenantExtension);
  return extended;
}

const globalForPrisma = /** @type {{ __cocoPrisma?: ReturnType<typeof buildExtendedClient> }} */ (globalThis);

const prisma = globalForPrisma.__cocoPrisma ?? buildExtendedClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__cocoPrisma = prisma;
}

export async function connectPostgres() {
  try {
    await prisma.$connect();
    // eslint-disable-next-line no-console
    console.log("Connected to PostgreSQL via Prisma");
  } catch (err) {
    throw new Error(`Failed to connect to PostgreSQL.\n${err.message}`);
  }
}

export async function disconnectPostgres() {
  if (process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.warn("'disconnectPostgres' called outside a testing env.");
  }
  await prisma.$disconnect();
}

export async function resetPostgres() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Call outside testing environment.");
  }

  const tables = await prisma.$queryRaw`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;

  if (!tables.length) return;

  const tableLists = tables
    .map((t) => `"public"."${t.tablename}"`)
    .join(", ");
  await prisma.$queryRawUnsafe(
    `TRUNCATE TABLE ${tableLists} RESTART IDENTITY CASCADE`
  );
}

export async function dropPostgresDatabase() {
  await resetPostgres();
}

export default prisma;
