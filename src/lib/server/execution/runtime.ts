import "server-only";
import { after } from "next/server";
import type { Instant } from "@/lib/contracts/core";
import { createPersistedAuthorization } from "@/lib/server/auth/persistence";
import { getDb } from "@/lib/server/db";
import { createHandoffService } from "@/lib/server/handoff";
import { createHandoffNoteService } from "@/lib/server/handoff-note";
import { createIncidentService } from "@/lib/server/incidents";
import { createRequestValidator } from "@/lib/server/http/validate";
import { createDefaultNotificationService } from "@/lib/server/notifications";
import { createOpenRouterProvider } from "@/lib/server/providers/openrouter";
import { PostgresPersistence } from "@/lib/server/repositories";
import { createReadService } from "@/lib/server/state";
import { createExecutionService } from "./index";
import { handleCommand, handleState, type ExecutionHttpDeps } from "./http";

let cached: ExecutionHttpDeps | undefined;

/** Ensamblado perezoso: el pool, el proveedor y los secretos se leen en la primera petición, no al importar (build). */
function deps(): ExecutionHttpDeps {
  if (!cached) {
    const store = new PostgresPersistence(getDb());
    const now = () => new Date().toISOString() as Instant;
    const handoff = createHandoffService({ store });
    cached = {
      authorization: createPersistedAuthorization(store),
      service: createExecutionService({
        store, handoff, incidents: createIncidentService({ store, handoff }), notifications: createDefaultNotificationService(store),
        note: createHandoffNoteService({ unitOfWork: store, provider: createOpenRouterProvider() }),
        read: createReadService({ store, now }), now,
      }),
      validator: createRequestValidator(),
      afterResponse: work => after(async () => { try { await work(); } catch { /* el estado muestra preparation=pending/failed */ } }),
    };
  }
  return cached;
}

export const stateRoute = () => handleState(deps());
export const commandRoute = (route: "POST /api/scene" | "POST /api/reset", request: Request) => handleCommand(deps(), route, request);
