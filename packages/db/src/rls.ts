/**
 * @module @coco/db/rls
 * @description Sincroniza el GUC `app.current_organization_id` (consumido por
 * las políticas Row-Level Security de Postgres) con el tenant context de Node.
 *
 * Estrategia: por defecto setea el GUC en sesión (no transaction-local).
 * Para aislamiento estricto (cross-org bypass por super-admin, mutaciones
 * críticas), usar `withRls(client, orgId, opts, work)` que abre tx y aplica
 * SET LOCAL.
 */
import type { PrismaClient, Prisma } from "@prisma/client";
import { prismaBase } from "#/client.js";

type AnyPrismaLike = Pick<PrismaClient, "$executeRawUnsafe" | "$transaction">;

export type RlsTransaction = Prisma.TransactionClient;

/** Aplica el GUC sobre la conexión actual (sesión-scoped, no transaccional). */
export async function applyRlsSetting(
  orgId: bigint | number | string,
  opts: { bypass?: boolean; client?: AnyPrismaLike } = {},
): Promise<void> {
  const client = opts.client ?? prismaBase;
  const orgIdStr = String(orgId).replace(/'/g, "''");
  await client.$executeRawUnsafe(
    `SELECT set_config('app.current_organization_id', '${orgIdStr}', false)`,
  );
  await client.$executeRawUnsafe(
    `SELECT set_config('app.bypass_tenant', '${opts.bypass ? "on" : ""}', false)`,
  );
}

/** Limpia los GUCs (útil al finalizar request en pool conmutado). */
export async function clearRlsSetting(
  opts: { client?: AnyPrismaLike } = {},
): Promise<void> {
  const client = opts.client ?? prismaBase;
  await client.$executeRawUnsafe(
    `SELECT set_config('app.current_organization_id', '', false)`,
  );
  await client.$executeRawUnsafe(
    `SELECT set_config('app.bypass_tenant', '', false)`,
  );
}

/**
 * Ejecuta `work` dentro de una transacción con SET LOCAL del GUC.
 * Aislamiento estricto: el bypass NO se filtra a otros requests vía pool.
 */
export async function withRls<T>(
  orgId: bigint | number | string,
  opts: { bypass?: boolean; client?: AnyPrismaLike },
  work: (tx: RlsTransaction) => Promise<T>,
): Promise<T> {
  const client = opts.client ?? prismaBase;
  return client.$transaction(async (tx) => {
    const orgIdStr = String(orgId).replace(/'/g, "''");
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_organization_id', '${orgIdStr}', true)`,
    );
    if (opts.bypass) {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.bypass_tenant', 'on', true)`,
      );
    }
    return work(tx);
  });
}
