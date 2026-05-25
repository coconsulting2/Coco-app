/**
 * @module ReimbursementTimeRepository
 * @description Puerto para la persistencia del plazo de comprobación de gastos
 * por organización (M2-006 RF-37). El adapter concreto Prisma vive en
 * `infrastructure/PrismaReimbursementTimeRepository`. Las queries de bloqueo
 * automático y deadlines viven en `reimbursementTimeQueries` (servicio legacy
 * del slice) — este puerto cubre SOLO el get/upsert de configuración expuesto
 * por la admin UI.
 */

export type ReimbursementTimeLimitRow = {
  daysAfterTrip: number;
  graceDays: number;
  blockOnExpiry: boolean;
  active: boolean;
};

export type ReimbursementTimeLimitUpsert = {
  daysAfterTrip: number;
  graceDays: number;
  blockOnExpiry: boolean;
  active: boolean;
  updatedById: number | null;
};

export interface ReimbursementTimeRepository {
  /** Config de la organización, o `null` si nunca se ha guardado. */
  findByOrg(
    organizationId: bigint | number,
  ): Promise<ReimbursementTimeLimitRow | null>;
  /** Crea o actualiza la config de la organización. */
  upsert(
    organizationId: bigint | number,
    data: ReimbursementTimeLimitUpsert,
  ): Promise<ReimbursementTimeLimitRow>;
}
