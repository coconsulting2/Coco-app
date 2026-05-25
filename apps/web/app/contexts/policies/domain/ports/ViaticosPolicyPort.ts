/**
 * @module ViaticosPolicyPort
 * @description Puertos para la política de viáticos: lectura de orgId de
 * usuario y repositorio de la política. Implementados por adapters Prisma en
 * `infrastructure/viaticasPolicyQueries` y `infrastructure/viaticasPolicyModel`.
 */
import type {
  ViaticosPolicyPayload,
  ViaticosPolicyRow,
} from "~/contexts/policies/domain/types";

export interface ViaticosUserQueriesPort {
  getUserOrganizationId(userId: number): Promise<bigint | null>;
}

export interface ViaticosPolicyRepositoryPort {
  getByOrg(organizationId: bigint | number): Promise<ViaticosPolicyRow | null>;
  upsert(
    organizationId: bigint | number,
    payload: ViaticosPolicyPayload,
  ): Promise<ViaticosPolicyRow>;
}
