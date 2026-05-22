/**
 * @module PrismaUserRepository
 * @description Adapter Prisma del port `UserRepository`. Único sitio del slice
 * identity con acceso directo al cliente Prisma (vía la shim `~/platform/db/prisma.server`
 * que añade el trigger extension de dominio y compose @coco/db).
 *
 * Mapea entre domain (camelCase: UserProfile) y persistencia (snake_case / Prisma
 * field names). Es el único lugar donde la PII se almacena encriptada — la
 * desencriptación pasa por `PiiCipher` aplicado en application layer.
 */
import prisma from "~/platform/db/prisma.server.js";
import { getTenantContext } from "@coco/db";
import type {
  UserRepository,
  AdminUserView,
} from "~/contexts/identity/domain/ports/UserRepository.js";
import type {
  CreateUserInput,
  UpdateUserInput,
  UserId,
  UserProfile,
  OrganizationId,
} from "~/contexts/identity/domain/entities/User.js";
import type { UserRole } from "~/shared/types/roles.js";

type PrismaUserWithRelations = {
  userId: number;
  userName: string;
  email: string;
  phoneNumber: string;
  workstation: string;
  noEmpleado: string | null;
  password: string;
  active: boolean;
  organizationId: bigint;
  departmentId: number | null;
  creationDate: Date;
  role: { roleName: string } | null;
  department: { departmentName: string; costsCenter: string | null } | null;
  organization: { kind: string; status: string; nombre: string | null } | null;
};

/**
 * Resultado expuesto por findByUsername — incluye campos sensibles (password,
 * active, organization status) necesarios para el use-case `authenticateUser`
 * pero NO incluidos en `UserProfile` público.
 *
 * UserProfile estricto omite estos campos; authenticateUser usa una vista
 * más rica via método dedicado.
 */
export type AuthenticationLookup = {
  userId: UserId;
  username: string;
  passwordHash: string;
  active: boolean;
  role: UserRole;
  organizationId: OrganizationId;
  organizationKind: string;
  organizationStatus: string;
  departmentId: number | null;
  employeeNumber: string | null;
};

function toUserProfile(row: PrismaUserWithRelations): UserProfile {
  return {
    userId: row.userId,
    username: row.userName,
    email: row.email,
    phoneNumber: row.phoneNumber,
    workstation: row.workstation,
    employeeNumber: row.noEmpleado,
    departmentName: row.department?.departmentName ?? "",
    costsCenter: row.department?.costsCenter ?? null,
    creationDate: row.creationDate,
    roleName: (row.role?.roleName ?? "Solicitante") as UserRole,
  };
}

export class PrismaUserRepository implements UserRepository {
  async findById(userId: UserId): Promise<UserProfile | null> {
    const row = await prisma.user.findUnique({
      where: { userId: Number(userId) },
      include: {
        role: true,
        department: true,
        organization: true,
      },
    });
    if (!row) return null;
    return toUserProfile(row as unknown as PrismaUserWithRelations);
  }

  async findByUsername(
    _username: string,
    _organizationId?: OrganizationId | null,
  ): Promise<UserProfile | null> {
    // Para login se debe usar `findAuthenticationLookup` que devuelve más
    // campos (password, active, org status). findByUsername del port
    // restringido a UserProfile no aplica al login flow.
    throw new Error(
      "findByUsername del port UserProfile no se usa para login. Usa `PrismaUserRepository.findAuthenticationLookup` para autenticar.",
    );
  }

  /**
   * Lookup específico para authentication — devuelve los campos sensibles
   * que el use-case `authenticateUser` necesita. Login ocurre sin tenant
   * context: usa bypass local de RLS dentro de la transacción.
   */
  async findAuthenticationLookup(
    username: string,
    organizationHint?: OrganizationId | null,
  ): Promise<
    | AuthenticationLookup
    | { kind: "ambiguous"; organizations: Array<{ id: string; nombre: string }> }
    | null
  > {
    type MatchedUser = Awaited<
      ReturnType<typeof prisma.user.findFirst>
    > & {
      role: { roleName: string } | null;
      organization: { kind: string; status: string; nombre: string | null } | null;
    };

    type TxResult =
      | { kind: "found"; user: MatchedUser }
      | { kind: "ambiguous"; organizations: Array<{ id: string; nombre: string }> }
      | { kind: "none" };

    const result = await prisma.$transaction(async (tx): Promise<TxResult> => {
      await tx.$executeRaw`SELECT set_config('app.bypass_tenant', 'on', true)`;
      const matches = await tx.user.findMany({
        where: { userName: username },
        include: { role: true, organization: true, empleado: true },
      });
      if (matches.length === 0) return { kind: "none" };
      if (organizationHint != null) {
        const hit = matches.find(
          (u) => BigInt(u.organizationId) === BigInt(organizationHint),
        );
        return hit ? { kind: "found", user: hit as MatchedUser } : { kind: "none" };
      }
      if (matches.length === 1) {
        return { kind: "found", user: matches[0] as MatchedUser };
      }
      return {
        kind: "ambiguous",
        organizations: matches.map((u) => ({
          id: String(u.organizationId),
          nombre: u.organization?.nombre ?? "",
        })),
      };
    });

    if (result.kind === "none") return null;
    if (result.kind === "ambiguous") {
      return { kind: "ambiguous", organizations: result.organizations };
    }
    const row = result.user;
    return {
      userId: row.userId,
      username: row.userName,
      passwordHash: row.password,
      active: row.active,
      role: (row.role?.roleName ?? "Solicitante") as UserRole,
      organizationId: BigInt(row.organizationId),
      organizationKind: row.organization?.kind ?? "CLIENT",
      organizationStatus: row.organization?.status ?? "ACTIVE",
      departmentId: row.departmentId,
      employeeNumber: row.noEmpleado,
    };
  }

  async create(input: CreateUserInput): Promise<UserProfile> {
    const orgId = BigInt(String(input.organizationId));
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.email },
          { userName: input.username, organizationId: orgId },
        ],
      },
      select: { userId: true },
    });
    if (existing) {
      throw new Error("User with this email or username already exists in this organization");
    }
    const created = await prisma.user.create({
      data: {
        organizationId: orgId,
        roleId: input.roleId,
        departmentId: input.departmentId,
        userName: input.username,
        password: input.password,
        workstation: input.workstation,
        email: input.email,
        phoneNumber: input.phoneNumber,
      },
      include: { role: true, department: true, organization: true },
    });
    return toUserProfile(created as unknown as PrismaUserWithRelations);
  }

  async update(userId: UserId, fields: UpdateUserInput): Promise<UserProfile> {
    const data: Record<string, unknown> = {};
    if (fields.username !== undefined) data.userName = fields.username;
    if (fields.password !== undefined) data.password = fields.password;
    if (fields.email !== undefined) data.email = fields.email;
    if (fields.phoneNumber !== undefined) data.phoneNumber = fields.phoneNumber;
    if (fields.workstation !== undefined) data.workstation = fields.workstation;
    if (fields.roleId !== undefined) data.roleId = fields.roleId;
    if (fields.departmentId !== undefined) data.departmentId = fields.departmentId;
    if (fields.employeeNumber !== undefined) data.noEmpleado = fields.employeeNumber;
    const updated = await prisma.user.update({
      where: { userId: Number(userId) },
      data,
      include: { role: true, department: true, organization: true },
    });
    return toUserProfile(updated as unknown as PrismaUserWithRelations);
  }

  async deactivate(userId: UserId): Promise<void> {
    await prisma.user.update({
      where: { userId: Number(userId) },
      data: { active: false },
    });
  }

  async list(): Promise<UserProfile[]> {
    const rows = await prisma.user.findMany({
      where: { active: true },
      orderBy: [{ organizationId: "asc" }, { departmentId: "asc" }],
      include: { role: true, department: true, organization: true },
    });
    return rows.map((r) => toUserProfile(r as unknown as PrismaUserWithRelations));
  }

  /**
   * Vista admin: incluye organization_id + organization_name + departmentId.
   * Acota a la org del actor salvo super-admin ROOT sin impersonar (lista global).
   */
  async listForAdmin(): Promise<AdminUserView[]> {
    const ctx = getTenantContext();
    const where: Record<string, unknown> = { active: true };
    let narrowByOrg = false;
    if (ctx && ctx.organizationId !== undefined && ctx.organizationId !== null) {
      if (!ctx.isRoot) narrowByOrg = true;
      else if (ctx.bypassTenant) narrowByOrg = true;
    }
    if (narrowByOrg && ctx) where.organizationId = ctx.organizationId;

    const users = await prisma.user.findMany({
      where,
      orderBy: [{ organizationId: "asc" }, { departmentId: "asc" }],
      include: {
        role: true,
        department: true,
        organization: { select: { id: true, nombre: true } },
      },
    });
    return users.map((u) => ({
      userId: u.userId,
      username: u.userName,
      email: u.email,
      active: u.active,
      roleName: u.role?.roleName ?? "",
      departmentName: u.department?.departmentName ?? null,
      departmentId: u.departmentId,
      phoneNumber: u.phoneNumber,
      organizationId: u.organizationId != null ? u.organizationId.toString() : null,
      organizationName: u.organization?.nombre ?? "",
    }));
  }

  async listEncryptedEmails(): Promise<string[]> {
    const rows = await prisma.user.findMany({ select: { email: true } });
    return rows.map((r) => r.email);
  }

  async createMany(inputs: CreateUserInput[]): Promise<{ count: number }> {
    const data = inputs.map((u) => ({
      organizationId: BigInt(String(u.organizationId)),
      roleId: u.roleId,
      departmentId: u.departmentId,
      userName: u.username,
      password: u.password,
      workstation: u.workstation,
      email: u.email,
      phoneNumber: u.phoneNumber,
    }));
    const result = await prisma.user.createMany({ data, skipDuplicates: true });
    return { count: result.count };
  }

  async getWallet(
    userId: UserId,
  ): Promise<{ userId: UserId; username: string; wallet: number } | null> {
    const row = await prisma.user.findUnique({
      where: { userId: Number(userId) },
      select: { userId: true, userName: true, wallet: true },
    });
    if (!row) return null;
    return { userId: row.userId, username: row.userName, wallet: row.wallet };
  }

  /**
   * Busca un usuario en una org específica (para validaciones cross-tenant
   * por super-admin).
   */
  async findInOrganization(
    userId: UserId,
    organizationId: OrganizationId,
  ): Promise<{ userId: UserId; organizationId: OrganizationId; employeeNumber: string | null } | null> {
    const row = await prisma.user.findFirst({
      where: {
        userId: Number(userId),
        organizationId: BigInt(organizationId),
      },
      select: { userId: true, organizationId: true, noEmpleado: true },
    });
    if (!row) return null;
    return {
      userId: row.userId,
      organizationId: BigInt(row.organizationId),
      employeeNumber: row.noEmpleado,
    };
  }
}
