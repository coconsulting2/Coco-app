/**
 * @module Organization
 * @description Entidad de dominio del slice organizations. Tipos puros —
 * los mappers en `infrastructure/` traducen entre Prisma y este shape.
 */

export type Organization = {
  organizationId: bigint;
  name: string;
  kind: "ROOT" | "CLIENT";
  status: "CONFIGURING" | "ACTIVE" | "SUSPENDED";
  rfc: string | null;
};
