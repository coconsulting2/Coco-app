/**
 * @module OrganizationRepository
 * @description Puerto del slice organizations. Los adapters concretos viven en
 * `infrastructure/`. Tipado fuerte (sesión LANE-ORG): los use-cases dependen
 * SOLO de estos contratos, no de Prisma.
 */

/** Fila persistida de organización tal como la expone el repositorio. */
export type OrganizationRecord = {
  id: bigint;
  nombre: string;
  rfc: string | null;
  razonSocial: string | null;
  logoUrl: string | null;
  timezone: string;
  baseCurrency: string;
  kind: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Datos para crear una organización (sin admin inicial). */
export type CreateOrganizationData = {
  nombre: string;
  rfc: string | null;
  razonSocial: string | null;
  timezone: string;
  baseCurrency: string;
  kind: string;
  status: string;
};

/** Campos editables vía `update`. */
export type UpdateOrganizationData = Partial<{
  nombre: string;
  logoUrl: string | null;
  timezone: string;
  baseCurrency: string;
  razonSocial: string | null;
  rfc: string | null;
  status: string;
}>;

export type ListOrganizationsWhere = Partial<{ kind: string; status: string }>;

export type ListOrganizationsPaging = {
  page: number;
  pageSize: number;
};

export type ListOrganizationsResult = {
  rows: OrganizationRecord[];
  total: number;
};

export interface OrganizationRepository {
  list(
    where: ListOrganizationsWhere,
    paging: ListOrganizationsPaging,
  ): Promise<ListOrganizationsResult>;
  findById(id: bigint): Promise<OrganizationRecord | null>;
  create(data: CreateOrganizationData): Promise<OrganizationRecord>;
  update(id: bigint, data: UpdateOrganizationData): Promise<OrganizationRecord>;
}
