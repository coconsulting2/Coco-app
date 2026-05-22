// AUTO-GENERATED FILE. DO NOT EDIT.
// Regenerate via: bun --filter @coco/contracts generate
// Source: apps/web/openapi/swagger-*.yaml
export interface paths {
    "/api/accounts-payable/accounting-export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Exportar polizas contables por rango de fechas
         * @description Exporta polizas para solicitudes finalizadas en un rango [from, to].
         *     Requiere rol `Cuentas por pagar`.
         */
        get: {
            parameters: {
                query: {
                    format?: "json" | "xml";
                    from: string;
                    to: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Exportacion exitosa */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PolizasResponse"];
                        "application/xml": string;
                    };
                };
                /** @description Parametros `from/to` invalidos */
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
                /** @description Rol no permitido */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuthErrorResponse"];
                    };
                };
                /** @description Error interno del servidor */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/accounts-payable/accounting-export/{request_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Exportar polizas contables de una solicitud
         * @description Exporta polizas de una solicitud especifica. Requiere rol `Cuentas por pagar`.
         */
        get: {
            parameters: {
                query?: {
                    format?: "json" | "xml";
                };
                header?: never;
                path: {
                    request_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Exportacion exitosa */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PolizasResponse"];
                        "application/xml": string;
                    };
                };
                /** @description Póliza inválida para SAP (ej. cuenta de gasto sin CeCo o desbalance Debe/Haber) */
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
                /** @description Rol no permitido */
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
                /** @description Solicitud no finalizada para exportacion */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Error interno del servidor */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/accounts-payable/polizas": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar pólizas contables persistidas
         * @description Devuelve metadatos de pólizas generadas o exportadas (tabla `accounting_poliza`).
         *     Filtra por `request_id` y/o rango de fechas de creación. Requiere permiso `accounting:export`.
         */
        get: {
            parameters: {
                query?: {
                    from?: string;
                    limit?: number;
                    request_id?: number;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Lista de pólizas */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            polizas?: components["schemas"]["AccountingPolizaListItem"][];
                        };
                    };
                };
                /** @description Parámetros de consulta inválidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Token ausente o inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuthErrorResponse"];
                    };
                };
                /** @description Rol no permitido */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuthErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/accounts-payable/polizas/{poliza_id}/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Exportar una póliza persistida por id
         * @description Devuelve el JSON (o XML con `?format=xml`) de una fila `accounting_poliza` del tenant actual.
         */
        get: {
            parameters: {
                query?: {
                    format?: "json" | "xml";
                };
                header?: never;
                path: {
                    poliza_id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Payload de póliza */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": Record<string, never>;
                        "application/xml": string;
                    };
                };
                /** @description Póliza no encontrada */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/accounts-payable/polizas/{request_id}/generar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Generar y persistir pólizas (sin marcar solicitud exportada)
         * @description Construye AV/GV para la solicitud finalizada, valida balance y longitudes, persiste filas en `accounting_poliza`
         *     con `request_marked_exported=false`. No cambia `Request.is_exported` (diferencia respecto a `accounting-export`).
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    request_id: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Pólizas generadas */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PolizasResponse"];
                    };
                };
                /** @description Validación contable o SAP */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Token ausente o inválido */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Rol no permitido */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Solicitud no encontrada */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Solicitud no finalizada */
                409: {
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
    "/api/comprobantes/{id}/validacion-sat": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Endpoint planificado de consulta SAT por comprobante
         * @deprecated
         * @description Este endpoint se documenta para trazabilidad de M1, pero actualmente NO esta implementado
         *     en el backend.
         *
         *     Estado actual:
         *     - La validacion SAT activa se ejecuta en el flujo de aprobacion:
         *       `PUT /api/accounts-payable/validate-receipt/{receipt_id}`.
         */
        get: {
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
                /** @description No implementado */
                501: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        /**
                         * @example {
                         *       "error": "Endpoint pendiente de implementacion"
                         *     }
                         */
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/comprobantes/{receipt_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Crear comprobante CFDI para un recibo
         * @description Inserta un CFDI asociado a un `receipt_id`, valida formato, UUID duplicado y estado SAT.
         *     Requiere autenticacion con rol `Solicitante`, `N1` o `N2`.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    receipt_id: components["parameters"]["ReceiptId"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    /**
                     * @example {
                     *       "uuid": "550e8400-e29b-41d4-a716-446655440000",
                     *       "fecha_timbrado": "2026-04-09T10:05:00",
                     *       "rfc_pac": "SAT970701NN3",
                     *       "version": "4.0",
                     *       "serie": "A",
                     *       "folio": "12345",
                     *       "fecha_emision": "2026-04-09T10:00:00",
                     *       "tipo_comprobante": "I",
                     *       "lugar_expedicion": "64000",
                     *       "exportacion": "01",
                     *       "metodo_pago": "PUE",
                     *       "forma_pago": "03",
                     *       "moneda": "MXN",
                     *       "tipo_cambio": 1,
                     *       "subtotal": 1000,
                     *       "iva": 160,
                     *       "total": 1160,
                     *       "rfc_emisor": "AAA010101AAA",
                     *       "nombre_emisor": "EMPRESA EJEMPLO S.A. DE C.V.",
                     *       "regimen_fiscal_emisor": "601",
                     *       "rfc_receptor": "COSC8001137NA",
                     *       "nombre_receptor": "CLIENTE EJEMPLO S.A. DE C.V.",
                     *       "domicilio_fiscal_receptor": "64000",
                     *       "regimen_fiscal_receptor": "601",
                     *       "uso_cfdi": "G03",
                     *       "sello_emisor": "0123456789ABCDEF0123456789ABCDEF"
                     *     }
                     */
                    "application/json": components["schemas"]["CfdiCreateRequest"];
                };
            };
            responses: {
                /** @description CFDI creado correctamente */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CfdiCreateResponse"];
                    };
                };
                /** @description Datos invalidos o receipt no ligado a solicitud */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ValidationErrorResponse"] | components["schemas"]["ErrorResponse"];
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
                /** @description Rol no permitido o politica de carga no valida */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuthErrorResponse"] | components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Receipt no encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        /**
                         * @example {
                         *       "error": "Receipt 1 not found"
                         *     }
                         */
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Conflicto SAT, EFOS o UUID duplicado */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Error interno del servidor */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Servicio SAT no disponible */
                503: {
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
    "/api/exchange-rate/rate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Obtener tipo de cambio entre monedas
         * @description Retorna tipo de cambio actual (cache, Wise o DOF/Banxico).
         */
        get: {
            parameters: {
                query?: {
                    source?: string;
                    target?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Tipo de cambio obtenido */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        /**
                         * @example {
                         *       "success": true,
                         *       "data": {
                         *         "rate": 17.23,
                         *         "source": "DOF",
                         *         "date": "22/04/2026",
                         *         "fromCache": false
                         *       },
                         *       "message": "Exchange rate from USD to MXN retrieved successfully"
                         *     }
                         */
                        "application/json": components["schemas"]["ExchangeRateResponse"];
                    };
                };
                /** @description Parametros invalidos */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ValidationErrorResponse"];
                    };
                };
                /** @description Error al obtener tipo de cambio */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ExchangeRateErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
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
         *     Coexistencia fase 2: si `WORKFLOW_APPROVAL_MODE=hierarchy`, el aprobador esperado
         *     se resuelve por cadena de mando (`manager_user_id`) manteniendo el mismo flujo de estados.
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
    "/api/solicitudes/{id}/reasignar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reasignar aprobador en snapshot N1/N2 */
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
                        motivo: string;
                        /** @description ID del usuario destino (rol N1 o N2) */
                        userId: number;
                    };
                };
            };
            responses: {
                /** @description Reasignación registrada */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            message?: string;
                        };
                    };
                };
                /** @description Validación fallida */
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
                /** @description Sin permiso */
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
    "/api/viajes/{id}/resumen-tramos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Obtener resumen consolidado por tramos de un viaje
         * @description Retorna el desglose de comprobantes por tramo y total general de un viaje.
         *     Requiere autenticacion con rol `Solicitante`, `N1`, `N2` o `Cuentas por pagar`.
         */
        get: {
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
                /** @description Resumen obtenido correctamente */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ResumenTramosResponse"];
                    };
                };
                /** @description ID de viaje invalido */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ValidationErrorResponse"];
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
                /** @description Sin permisos para consultar resumen */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuthErrorResponse"];
                    };
                };
                /** @description Viaje no encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        /**
                         * @example {
                         *       "error": "Viaje no encontrado"
                         *     }
                         */
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Error interno del servidor */
                500: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
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
        AccountingPolizaListItem: {
            /** Format: date-time */
            createdAt?: string;
            docType?: string;
            id?: string;
            polizaIndex?: number;
            requestId?: number;
            requestMarkedExported?: boolean;
        };
        AuthErrorResponse: {
            error: string;
            message: string;
            statusCode: number;
        };
        CfdiCreateRequest: {
            descuento?: number;
            domicilio_fiscal_receptor: string;
            /** @enum {string} */
            exportacion?: "01" | "02" | "03" | "04";
            /** Format: date-time */
            fecha_emision: string;
            /** Format: date-time */
            fecha_timbrado: string;
            folio?: string;
            forma_pago: string;
            iva?: number;
            lugar_expedicion: string;
            /** @enum {string} */
            metodo_pago: "PUE" | "PPD";
            moneda: string;
            nombre_emisor: string;
            nombre_receptor: string;
            regimen_fiscal_emisor: string;
            regimen_fiscal_receptor: string;
            rfc_emisor: string;
            rfc_pac: string;
            rfc_receptor: string;
            sello_emisor?: string;
            serie?: string;
            subtotal: number;
            tipo_cambio?: number;
            /** @enum {string} */
            tipo_comprobante: "I" | "E" | "T" | "P" | "N";
            total: number;
            uso_cfdi: string;
            /** Format: uuid */
            uuid: string;
            /** @enum {string} */
            version?: "3.3" | "4.0";
        };
        CfdiCreateResponse: {
            cfdiId?: number;
            receiptId?: number;
            satEstado?: string;
            satValidacionEfos?: string;
            uuid?: string;
        };
        ErrorResponse: {
            error: string;
        };
        ExchangeRateErrorResponse: {
            error: string;
            message: string;
            success: boolean;
        };
        ExchangeRateResponse: {
            data: {
                date?: string;
                fromCache?: boolean;
                rate?: number;
                source?: string;
            };
            message: string;
            success: boolean;
        };
        Poliza: {
            detalle: components["schemas"]["PolizaLine"][];
            /**
             * @deprecated
             * @description Alias temporal de compatibilidad. Usar `detalle`.
             */
            detalles?: components["schemas"]["PolizaLine"][];
            header: components["schemas"]["PolizaHeader"];
        };
        PolizaHeader: {
            COMP_CODE: string;
            CURRENCY: string;
            /** @enum {string} */
            DOC_TYPE: "AV" | "GV";
            EXCH_RATE: number;
            HEADER_TXT: string;
            ID_VIAJE: string;
            /** Format: date */
            PSTNG_DATE: string;
        };
        PolizaLine: {
            AMT_DOCCUR: number;
            COSTCENTER?: string;
            GL_ACCOUNT: string;
            ITEM_TEXT: string;
            ITEMNO_ACC: number;
            /** @enum {string} */
            SHKZG: "S" | "H";
            VENDOR_NO?: string;
        };
        PolizasResponse: {
            polizas: components["schemas"]["Poliza"][];
        };
        ResumenTramosResponse: {
            total_general: number;
            tramos: {
                beginning_date?: string | null;
                comprobantes?: {
                    amount?: number;
                    gasto_tramo_id?: number;
                    receipt_id?: number;
                    receipt_type?: string | null;
                    submission_date?: string | null;
                    validation?: string | null;
                }[];
                destination_city?: string | null;
                destination_country?: string | null;
                ending_date?: string | null;
                origin_city?: string | null;
                origin_country?: string | null;
                router_index?: number | null;
                total_tramo?: number;
                tramo_id?: number | null;
            }[];
            viaje_id: number;
        };
        ValidationErrorResponse: {
            errors: {
                msg?: string;
                path?: string;
            }[];
        };
    };
    responses: never;
    parameters: {
        ReceiptId: number;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
