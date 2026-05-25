/**
 * @file legacy-js.d.ts
 * @description Ambient declarations for the **platform boundary** `.js` modules
 * that intentionally stay as JavaScript (Bun runtime quirks, pino transport,
 * GridFS/Mongo, cron schedulers). These are NOT slice business logic — todos los
 * slices de `app/contexts/**` ya fueron convertidos a `.ts` hexagonal proper, así
 * que no quedan entries de contexto aquí.
 *
 * Cada módulo se declara con su **firma real tipada** (no `any`), de modo que los
 * consumidores TypeScript obtienen contratos completos sin necesidad de
 * `@ts-ignore`. Si alguno de estos `.js` se convierte a `.ts` en el futuro,
 * borra su entry de este archivo.
 */

// ── permission service (platform/permissions/permission-service.server.js) ──
declare module "~/platform/permissions/permission-service.server.js" {
  /** Códigos de permiso efectivos del usuario (rol + grupos + grants directos). */
  export function loadEffectivePermissions(userId: number): Promise<string[]>;
  /** Códigos de permiso que tendría un usuario solo por su rol. */
  export function loadEffectivePermissionsForRole(roleId: number): Promise<string[]>;

  export function getPermissions(opts?: Record<string, unknown>): Promise<unknown[]>;
  export function createPermission(input: {
    code: string;
    resource: string;
    action: string;
    description?: string;
  }): Promise<unknown>;
  export function updatePermission(permissionId: number, data: Record<string, unknown>): Promise<unknown>;
  export function deactivatePermission(permissionId: number): Promise<unknown>;

  export function getPermissionGroups(): Promise<unknown[]>;
  export function getPermissionGroup(id: number): Promise<unknown>;
  export function createPermissionGroup(data: Record<string, unknown>): Promise<unknown>;
  export function updatePermissionGroup(id: number, data: Record<string, unknown>): Promise<unknown>;
  export function deactivatePermissionGroup(id: number): Promise<unknown>;
  export function addPermissionsToGroup(groupId: number, permissionIds: number[]): Promise<unknown>;
  export function removePermissionFromGroup(groupId: number, permissionId: number): Promise<unknown>;

  export function addPermissionsToRole(roleId: number, permissionIds: number[]): Promise<unknown>;
  export function removePermissionFromRole(roleId: number, permissionId: number): Promise<unknown>;
  export function addGroupsToRole(roleId: number, groupIds: number[]): Promise<unknown>;
  export function removeGroupFromRole(roleId: number, groupId: number): Promise<unknown>;

  export function addPermissionsToUser(userId: number, permissionIds: number[]): Promise<unknown>;
  export function removePermissionFromUser(userId: number, permissionId: number): Promise<unknown>;
  export function addGroupsToUser(userId: number, groupIds: number[]): Promise<unknown>;
  export function removeGroupFromUser(userId: number, groupId: number): Promise<unknown>;

  export function getUserEffectivePermissions(userId: number): Promise<unknown>;

  export function listTenantRolesForAdmin(): Promise<unknown[]>;
  export function createTenantRole(payload: Record<string, unknown>): Promise<unknown>;
  export function updateTenantRole(roleId: number, payload: Record<string, unknown>): Promise<unknown>;
  export function deleteTenantRole(roleId: number): Promise<unknown>;
}

// ── http errors (platform/http/errors.server.js) ───────────────────────────
declare module "~/platform/http/errors.server.js" {
  export class MissingTokenError extends Error {}
  export class ExpiredTokenError extends Error {}
  export class InvalidTokenError extends Error {}
  export class TokenMismatchError extends Error {}
  export class AuthError extends Error {}
  export class InsufficientPermissionsError extends Error {}
}

// ── GridFS / Mongo (platform/mongo/gridfs.server.js) ───────────────────────
declare module "~/platform/mongo/gridfs.server.js" {
  import type { Readable } from "node:stream";
  import type { Db, GridFSBucket } from "mongodb";

  export function connectMongo(): Promise<Db>;
  export function disconnectMongo(): Promise<void>;
  export function resetMongo(): Promise<void>;
  export function dropMongoDatabase(): Promise<void>;
  export function uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    fileType: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ fileId: string; fileName: string }>;
  export function getFile(fileId: string): Promise<Readable>;
  export const db: Db;
  export const bucket: GridFSBucket;
}

// ── cron schedulers (platform/scheduler/*.js) ──────────────────────────────
declare module "~/platform/scheduler/index.js" {
  export function startScheduler(): void;
  export function stopScheduler(): void;
}

declare module "~/platform/scheduler/approval-substitute-cron.server.js" {
  export function runApprovalSubstituteSweep(): Promise<void>;
  export function startApprovalSubstituteCron(): Promise<void>;
  export function stopApprovalSubstituteCron(): void;
}

// ── structured logger (platform/logger/log/logger.js) ──────────────────────
declare module "~/platform/logger/log/logger.js" {
  import type { Logger as PinoLogger } from "pino";
  export const logger: PinoLogger;
  export function Logger(service: string): PinoLogger;
  export function close(): Promise<void>;
}
