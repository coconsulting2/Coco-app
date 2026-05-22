/**
 * @module UserRepository
 * @description Puerto (interface) del repositorio de usuarios. Los use-cases
 * dependen de esta interfaz, NO del modelo Prisma concreto. Los adapters
 * concretos viven en `infrastructure/` (PrismaUserRepository) y son los
 * únicos que importan @prisma/client.
 *
 * Ventaja: cambiar de Prisma a otra DB requiere SOLO escribir un adapter
 * nuevo. Los use-cases no cambian.
 */
import type {
  CreateUserInput,
  UpdateUserInput,
  UserId,
  UserProfile,
  OrganizationId,
} from "~/contexts/identity/domain/entities/User";

export interface UserRepository {
  /** Busca usuario por id (RLS-scoped). Devuelve null si no existe. */
  findById(userId: UserId): Promise<UserProfile | null>;

  /** Busca por username + opcional organizationId (para login multi-tenant). */
  findByUsername(username: string, organizationId?: OrganizationId | null): Promise<UserProfile | null>;

  /** Crea un usuario. Lanza error con status 4xx si email duplicado. */
  create(input: CreateUserInput): Promise<UserProfile>;

  /** Actualiza campos parciales. */
  update(userId: UserId, fields: UpdateUserInput): Promise<UserProfile>;

  /** Soft delete (active=false). */
  deactivate(userId: UserId): Promise<void>;

  /** Lista usuarios del tenant activo. */
  list(): Promise<UserProfile[]>;
}
