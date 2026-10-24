import "server-only";
import { after } from "next/server";
import type { Instant } from "@/lib/contracts/core";
import type { ServiceResult } from "@/lib/contracts/http";
import type { PublicStateDTO } from "@/lib/contracts/public";
import { createPersistedAuthorization } from "@/lib/server/auth/persistence";
import { getDb } from "@/lib/server/db";
import { createHandoffService } from "@/lib/server/handoff";
import { createIncidentService } from "@/lib/server/incidents";
import { createRequestValidator } from "@/lib/server/http/validate";
import { createDefaultNotificationService } from "@/lib/server/notifications";
import { PostgresPersistence } from "@/lib/server/repositories";
import { runtime as messagesRuntime } from "@/lib/server/messages/runtime";
import { createReadService } from "@/lib/server/state";
import { createExecutionService } from "./index";
import { handleCommand, handleState, type ExecutionHttpDeps } from "./http";
import { createSharedState, publicStateGeneration } from "./shared-state";

let cached: ExecutionHttpDeps | undefined;
let shared: { get(): Promise<ServiceResult<PublicStateDTO>> } | undefined;
const afterResponse = (work: () => Promise<unknown>) => after(async () => { try { await work(); } catch { /* el estado lo informa */ } });

/**
 * Ensamblado perezoso: el pool y los secretos se leen en la primera petición, no al importar (build). Sin servicio de
 * nota: el cierre no usa IA y el reset deja la preparación lista con el resumen fijo.
 */
function deps(): ExecutionHttpDeps {
  if (!cached) {
    const store = new PostgresPersistence(getDb());
    const now = () => new Date().toISOString() as Instant;
    const handoff = createHandoffService({ store });
    cached = {
      authorization: createPersistedAuthorization(store),
      service: createExecutionService({
        store, handoff, incidents: createIncidentService({ store, handoff }), notifications: createDefaultNotificationService(store),
        read: createReadService({ store, now }), now,
        reports: { rescueStalled: context => messagesRuntime().service.rescueStalled(context) },
        // Un aviso que falla queda pendiente o `failed` y se reintenta en la próxima consulta.
        deferDispatch: afterResponse,
      }),
      validator: createRequestValidator(),
      // El estado muestra preparation=pending si la preparación no terminó.
      afterResponse,
    };
  }
  return cached;
}

/** Las consultas simultáneas de esta instancia comparten una evaluación de hasta 1 s; una mutación la invalida (C07). */
function sharedState() {
  shared ??= createSharedState(() => deps().service.evaluateCurrent(), {
    maxAgeMs: 1_000, now: () => performance.now(), generation: publicStateGeneration, reusable: result => result.ok,
  });
  return shared;
}

export const stateRoute = (request: Request) => handleState({ service: { evaluateCurrent: () => sharedState().get() } }, request);
export const commandRoute = (route: "POST /api/scene" | "POST /api/qr" | "POST /api/reset", request: Request) => handleCommand(deps(), route, request);
