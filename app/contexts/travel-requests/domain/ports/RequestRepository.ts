/**
 * @module RequestRepository
 * @description Puerto del repositorio de solicitudes. Los use-cases dependen
 * de esta interfaz, no del modelo Prisma. El adapter concreto vive en
 * `infrastructure/PrismaRequestRepository.server.ts` (pendiente; el modelo
 * `applicantModel.js` legacy implementa el contrato de facto).
 */
import type {
  RequestId,
  UserId,
  TravelRequestSummary,
  TravelRequestDetail,
  CreateTravelRequestInput,
  EditTravelRequestInput,
} from "~/contexts/travel-requests/domain/entities/Request";

export interface RequestRepository {
  /** Lista solicitudes activas del usuario (no canceladas/finalizadas). */
  listActiveByUser(userId: UserId): Promise<TravelRequestSummary[]>;

  /** Lista solicitudes completadas/archivadas. */
  listCompletedByUser(userId: UserId): Promise<TravelRequestSummary[]>;

  /** Detalle de una solicitud (joins). */
  findDetailById(requestId: RequestId): Promise<TravelRequestDetail | null>;

  /** Crea una solicitud desde Solicitante. */
  create(input: CreateTravelRequestInput): Promise<TravelRequestDetail>;

  /** Actualiza una solicitud en estado editable. */
  update(input: EditTravelRequestInput): Promise<TravelRequestDetail>;

  /** Cancela (transición de estado). */
  cancel(requestId: RequestId): Promise<void>;

  /** Crea como borrador (status = "Borrador"). */
  createDraft(userId: UserId, partial: Partial<CreateTravelRequestInput>): Promise<TravelRequestDetail>;

  /** Confirma un borrador → "Primera Revisión". */
  confirmDraft(userId: UserId, requestId: RequestId): Promise<TravelRequestDetail>;

  /** Lookup de centro de costos por user. */
  findCostCenterByUserId(userId: UserId): Promise<{ id: number; name: string } | null>;
}
