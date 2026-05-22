/**
 * @module ApiKey
 * @description Entidad de dominio del slice api-keys. Tipos puros —
 * los mappers en `infrastructure/` traducen entre Prisma y este shape.
 */

export type ApiKey = {
  apiKeyId: number;
  organizationId: bigint;
  label: string;
  scope: string[];
  status: "active" | "revoked";
  createdAt: Date;
};
