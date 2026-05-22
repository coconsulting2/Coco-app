/**
 * @module @coco/contracts
 * @description Tipos generados desde el contrato OpenAPI público de CocoAPI.
 * Estos tipos son la fuente de verdad para los `/api/*` resource routes
 * sobrevivientes (Swagger M1/M2): los handlers en `apps/web/app/routes/api/`
 * los importan para validar request/response shapes.
 *
 * Los tipos se regeneran corriendo `bun --filter @coco/contracts generate`
 * después de cualquier cambio a los YAML en `apps/web/openapi/`.
 */
export type { paths as M1Paths, components as M1Components } from "#/m1.js";
export type { paths as M2Paths, components as M2Components } from "#/m2.js";

// Re-export como namespaces para conveniencia.
export * as M1 from "#/m1.js";
export * as M2 from "#/m2.js";
