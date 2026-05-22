/**
 * @module OnboardingImport
 * @description Entidad de dominio del slice onboarding. Tipos puros —
 * los mappers en `infrastructure/` traducen entre Prisma y este shape.
 */

export type OnboardingImport = {
  importId: string;
  organizationId: bigint;
  rowsTotal: number;
  rowsOk: number;
  rowsFailed: number;
  status: "running" | "completed" | "failed";
};
