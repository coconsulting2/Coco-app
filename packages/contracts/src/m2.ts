// AUTO-GENERATED FILE. DO NOT EDIT.
// Regenerate via: bun --filter @coco/contracts generate
// Source: apps/web/openapi/swagger-*.yaml
export interface paths {
    "/api/admin/permissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Listar todos los permisos */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Lista de permisos */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Permission"][];
                    };
                };
            };
        };
        put?: never;
        /** Crear nuevo permiso */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PermissionCreateInput"];
                };
            };
            responses: {
                /** @description Permiso creado */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/permissions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Desactivar un permiso */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Permiso desactivado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        /** Actualizar un permiso */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PermissionUpdateInput"];
                };
            };
            responses: {
                /** @description Permiso actualizado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        trace?: never;
    };
    "/api/admin/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar todos los roles
         * @description Retorna la lista de roles definidos en el sistema.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Lista de roles */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Role"][];
                    };
                };
            };
        };
        put?: never;
        /** Crear nuevo rol */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["RoleCreateInput"];
                };
            };
            responses: {
                /** @description Rol creado exitosamente */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/roles/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Actualizar un rol existente */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["RoleUpdateInput"];
                };
            };
            responses: {
                /** @description Rol actualizado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        post?: never;
        /** Eliminar un rol */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Rol eliminado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/config/roles/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Importar configuracion de roles de forma masiva */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        roles?: components["schemas"]["RoleCreateInput"][];
                    };
                };
            };
            responses: {
                /** @description Roles importados correctamente */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description JSON de importacion invalido */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/solicitudes/{id}/aprobar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Aprobar solicitud (workflow N1/N2, permiso travel_request:authorize)
         * @description Equivalente funcional a `can_approve`. Usa `requested_fee` y `Role.max_approval_amount`;
         *     si el monto supera el tope del aprobador y existe nivel N2, escala automáticamente (estado ESCALADO en historial).
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Aprobación o escalamiento aplicado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message?: string;
                            new_status?: string;
                            /** @enum {string} */
                            outcome?: "APROBADO" | "ESCALADO";
                        };
                    };
                };
                /** @description Solicitud no en estado de autorización o actor inválido */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Token ausente o invalido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuthErrorResponse"];
                    };
                };
                /** @description Sin permiso travel_request:authorize */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuthErrorResponse"];
                    };
                };
                /** @description Solicitud no encontrada */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Monto fuera de tope sin nivel al que escalar */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Error interno */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/solicitudes/{id}/rechazar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Rechazar solicitud (comentario obligatorio) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @description Motivo del rechazo (obligatorio) */
                        comentario: string;
                    };
                };
            };
            responses: {
                /** @description Solicitud rechazada */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message?: string;
                            new_status?: string;
                        };
                    };
                };
                /** @description Comentario vacío o estado inválido */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Token ausente o invalido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuthErrorResponse"];
                    };
                };
                /** @description Sin permiso de autorización */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuthErrorResponse"];
                    };
                };
                /** @description Solicitud no encontrada */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Error interno */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/workflow/simulate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Simular evaluación de reglas de workflow
         * @description Permite probar el nivel de aprobación (N1/N2) y topes requeridos para un monto y parámetros dados.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["WorkflowSimulateRequest"];
                };
            };
            responses: {
                /** @description Resultado de la simulación */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WorkflowSimulateResponse"];
                    };
                };
                /** @description Parametros invalidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AuthErrorResponse: {
            error: string;
            message: string;
            statusCode: number;
        };
        ErrorResponse: {
            error: string;
        };
        Permission: {
            action?: string;
            active?: boolean;
            code?: string;
            description?: string | null;
            permissionId?: number;
            resource?: string;
        };
        PermissionCreateInput: {
            action: string;
            code: string;
            description?: string | null;
            resource: string;
        };
        PermissionUpdateInput: {
            action?: string;
            active?: boolean;
            description?: string | null;
            resource?: string;
        };
        Role: {
            maxApprovalAmount?: number | null;
            roleId?: number;
            roleName?: string;
        };
        RoleCreateInput: {
            maxApprovalAmount?: number | null;
            roleName: string;
        };
        RoleUpdateInput: {
            maxApprovalAmount?: number | null;
            roleName?: string;
        };
        WorkflowSimulateRequest: {
            orgId: number;
            paramValue?: string | null;
            requestedFee: number;
            ruleType: string;
        };
        WorkflowSimulateResponse: {
            requiredApprovalLevel?: number;
            rulesEvaluated?: {
                action?: string;
                matched?: boolean;
                ruleId?: number;
            }[];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
