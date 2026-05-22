/**
 * @module Request
 * @description Entidad de dominio para Travel Request. Tipos puros del
 * dominio — independientes de Prisma. Los mappers en infrastructure/ traducen
 * entre representación Prisma (camelCase con relaciones) y estos tipos.
 *
 * Los 10 estados (Borrador → Primera Revisión → ... → Finalizado) se modelan
 * como union literal — el dominio sabe qué transiciones son legales.
 */

export type RequestId = number;
export type UserId = number;

/** 10 estados oficiales del workflow (ver cocowiki/docs/arquitectura-datos/flujos.md). */
export type RequestStatus =
  | "Borrador"
  | "Primera Revisión"
  | "Segunda Revisión"
  | "Cotización del Viaje"
  | "Atención Agencia de Viajes"
  | "Comprobación gastos del viaje"
  | "Validación de comprobantes"
  | "Finalizado"
  | "Cancelado"
  | "Rechazado";

export type RouteLeg = {
  routerIndex: number;
  originCountryName: string;
  originCityName: string;
  destinationCountryName: string;
  destinationCityName: string;
  beginningDate: string;       // ISO yyyy-mm-dd
  beginningTime: string | null;
  endingDate: string;
  endingTime: string | null;
  hotelNeeded: boolean;
  planeNeeded: boolean;
};

export type TravelRequestSummary = {
  requestId: RequestId;
  status: RequestStatus | string;  // string fallback for legacy data sin normalizar
  destinationCountry: string | null;
  beginningDate: string | Date | null;
  endingDate: string | Date | null;
};

export type TravelRequestDetail = {
  requestId: RequestId;
  status: RequestStatus | string;
  notes: string | null;
  requestedFee: number | null;
  imposedFee: number | null;
  requestDays: number;
  creationDate: string | Date;
  applicant: {
    userId: UserId;
    userName: string;
    email: string;
    phoneNumber: string;
  };
  routes: RouteLeg[];
};

/**
 * Input para crear una solicitud nueva (POST /crear-solicitud action).
 * `routes` mínimo de 1 leg. Otros campos opcionales.
 */
export type CreateTravelRequestInput = {
  applicantUserId: UserId;
  notes?: string;
  requestedFee?: number;
  imposedFee?: number;
  costCenterId?: number;
  mainRoute: Omit<RouteLeg, "routerIndex">;
  additionalRoutes?: Omit<RouteLeg, "routerIndex">[];
};

export type EditTravelRequestInput = {
  requestId: RequestId;
} & Partial<CreateTravelRequestInput>;
