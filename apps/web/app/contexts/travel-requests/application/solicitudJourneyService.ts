/**
 * @module solicitudJourneyService
 * @description Construye el recorrido completo de una solicitud para el
 * stepper horizontal.
 */

export type StepState = "completed" | "current" | "pending" | "skipped" | "failed" | "cancelled";

export type JourneyStepDef = {
  key: string;
  statusId: number;
  label: string;
};

export type JourneyStep = JourneyStepDef & {
  state: StepState;
  timestamp?: string | null;
  actor?: string | null;
  note?: string | null;
};

export type HistorialEntry = {
  accion: string;
  createdAt: Date;
  comentario?: string | null;
  user?: { userName?: string; role?: { roleName?: string } };
};

export function approvalLevelsFromSnapshot(snapshot: unknown): number[] {
  if (!snapshot || typeof snapshot !== "object") return [1, 2];
  const levels = (snapshot as { levels?: unknown }).levels;
  if (!Array.isArray(levels) || levels.length === 0) return [1, 2];
  const parsed = [...new Set(levels.map(Number).filter((n) => n === 1 || n === 2))];
  return parsed.length ? parsed.sort((a, b) => a - b) : [1, 2];
}

export function routeNeedsAgency(
  routeRequests: Array<{ route?: { hotelNeeded?: boolean; planeNeeded?: boolean } }>,
): boolean {
  if (!Array.isArray(routeRequests)) return false;
  return routeRequests.some((rr) => {
    const route = rr?.route ?? rr;
    return Boolean((route as { hotelNeeded?: boolean })?.hotelNeeded) ||
      Boolean((route as { planeNeeded?: boolean })?.planeNeeded);
  });
}

export function buildJourneyStepDefinitions(input: {
  workflowPreSnapshot?: unknown;
  routeRequests?: unknown[];
  includeDraft?: boolean;
}): JourneyStepDef[] {
  const levels = approvalLevelsFromSnapshot(input.workflowPreSnapshot);
  const includeDraft = input.includeDraft !== false;
  const steps: JourneyStepDef[] = [];

  if (includeDraft) {
    steps.push({ key: "draft", statusId: 1, label: "Borrador" });
  }
  if (levels.includes(1)) {
    steps.push({ key: "n1", statusId: 2, label: "Primera revisión" });
  }
  if (levels.includes(2)) {
    steps.push({ key: "n2", statusId: 3, label: "Segunda revisión" });
  }
  steps.push({ key: "quote", statusId: 4, label: "Cotización del viaje" });
  if (
    routeNeedsAgency(
      (input.routeRequests ?? []) as Array<{ route?: { hotelNeeded?: boolean; planeNeeded?: boolean } }>,
    )
  ) {
    steps.push({ key: "agency", statusId: 5, label: "Atención agencia de viajes" });
  }
  steps.push(
    { key: "expenses", statusId: 6, label: "Comprobación de gastos" },
    { key: "validation", statusId: 7, label: "Validación de comprobantes" },
    { key: "done", statusId: 8, label: "Finalizado" },
  );

  return steps;
}

function inferFailedStepKey(
  stepDefs: JourneyStepDef[],
  historial: HistorialEntry[],
): string {
  const approvalSteps = stepDefs.filter((s) => s.key === "n1" || s.key === "n2");
  if (!approvalSteps.length) return "quote";
  const approvals = historial.filter((h) => h.accion === "APROBADO").length;
  if (approvals >= approvalSteps.length) {
    return approvalSteps[approvalSteps.length - 1]!.key;
  }
  return approvalSteps[approvals]?.key ?? approvalSteps[0]!.key;
}

function resolveStepStates(
  stepDefs: JourneyStepDef[],
  currentStatusId: number,
  historial: HistorialEntry[],
): Map<string, StepState> {
  const states = new Map<string, StepState>();

  if (currentStatusId === 9) {
    for (const step of stepDefs) {
      states.set(step.key, step.statusId === 9 ? "failed" : "cancelled");
    }
    states.set("draft", "completed");
    return states;
  }

  if (currentStatusId === 10) {
    const failedKey = inferFailedStepKey(stepDefs, historial);
    let pastFailed = true;
    for (const step of stepDefs) {
      if (step.key === failedKey) {
        states.set(step.key, "failed");
        pastFailed = false;
      } else if (pastFailed) {
        states.set(step.key, "completed");
      } else {
        states.set(step.key, "cancelled");
      }
    }
    return states;
  }

  for (const step of stepDefs) {
    if (currentStatusId > step.statusId) {
      states.set(step.key, "completed");
    } else if (currentStatusId === step.statusId) {
      states.set(step.key, "current");
    } else {
      states.set(step.key, "pending");
    }
  }

  return states;
}

function annotateStepsFromHistorial(
  stepDefs: JourneyStepDef[],
  historial: HistorialEntry[],
  creationDate: Date,
): Map<string, { timestamp: string | null; actor: string | null; note: string | null }> {
  const meta = new Map<
    string,
    { timestamp: string | null; actor: string | null; note: string | null }
  >();

  meta.set("draft", {
    timestamp: creationDate.toISOString(),
    actor: null,
    note: null,
  });

  const approvalKeys = stepDefs
    .filter((s) => s.key === "n1" || s.key === "n2")
    .map((s) => s.key);
  const approvals = historial.filter((h) => h.accion === "APROBADO");
  approvalKeys.forEach((key, idx) => {
    const row = approvals[idx];
    if (!row) return;
    meta.set(key, {
      timestamp: row.createdAt.toISOString(),
      actor: row.user?.userName ?? null,
      note: row.comentario ?? null,
    });
  });

  const reject = historial.find((h) => h.accion === "RECHAZADO");
  if (reject) {
    const failedKey = inferFailedStepKey(stepDefs, historial);
    meta.set(failedKey, {
      timestamp: reject.createdAt.toISOString(),
      actor: reject.user?.userName ?? null,
      note: reject.comentario ?? null,
    });
  }

  for (const row of historial) {
    if (row.accion === "ESCALADO" || row.accion === "REASIGNADO") {
      const note = row.comentario ? `${row.accion}: ${row.comentario}` : row.accion;
      const targetKey = approvalKeys.find((k) => !meta.get(k)?.actor) ?? approvalKeys[0];
      if (targetKey) {
        const prev = meta.get(targetKey) ?? { timestamp: null, actor: null, note: null };
        meta.set(targetKey, {
          ...prev,
          note: prev.note ? `${prev.note} · ${note}` : note,
        });
      }
    }
  }

  return meta;
}

export type BuildJourneyInput = {
  currentStatusId: number;
  currentStatusLabel?: string;
  workflowPreSnapshot?: unknown;
  routeRequests?: unknown[];
  creationDate: Date;
  historial?: HistorialEntry[];
};

export type JourneyOutput = {
  currentStatusId: number;
  currentStatusLabel: string;
  steps: JourneyStep[];
  events: Array<{
    action: string;
    user: string;
    role: string;
    timestamp: string;
    comment: string | null;
  }>;
};

export function buildSolicitudJourney(input: BuildJourneyInput): JourneyOutput {
  const currentStatusId = Number(input.currentStatusId);
  const historial = input.historial ?? [];
  const stepDefs = buildJourneyStepDefinitions({
    workflowPreSnapshot: input.workflowPreSnapshot,
    routeRequests: input.routeRequests,
    includeDraft: true,
  });

  const stateMap = resolveStepStates(stepDefs, currentStatusId, historial);
  const metaMap = annotateStepsFromHistorial(stepDefs, historial, input.creationDate);

  const steps: JourneyStep[] = stepDefs.map((def) => {
    const meta = metaMap.get(def.key);
    return {
      key: def.key,
      statusId: def.statusId,
      label: def.label,
      state: stateMap.get(def.key) ?? "pending",
      timestamp: meta?.timestamp ?? null,
      actor: meta?.actor ?? null,
      note: meta?.note ?? null,
    };
  });

  if (currentStatusId === 9) {
    steps.push({
      key: "cancelled",
      statusId: 9,
      label: "Cancelado",
      state: "failed",
      timestamp: null,
      actor: null,
      note: null,
    });
  } else if (currentStatusId === 10) {
    const reject = historial.find((h) => h.accion === "RECHAZADO");
    steps.push({
      key: "rejected",
      statusId: 10,
      label: "Rechazado",
      state: "failed",
      timestamp: reject?.createdAt.toISOString() ?? null,
      actor: reject?.user?.userName ?? null,
      note: reject?.comentario ?? null,
    });
  }

  const events = historial.map((h) => ({
    action: h.accion,
    user: h.user?.userName ?? "Usuario",
    role: h.user?.role?.roleName ?? "",
    timestamp: h.createdAt.toISOString(),
    comment: h.comentario || null,
  }));

  return {
    currentStatusId,
    currentStatusLabel: input.currentStatusLabel ?? "",
    steps,
    events,
  };
}
