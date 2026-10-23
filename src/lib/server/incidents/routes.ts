import "server-only";
import { getDb } from "@/lib/server/db";
import { createPersistedAuthorization } from "@/lib/server/auth/persistence";
import { createRequestValidator } from "@/lib/server/http/validate";
import { createHandoffService } from "@/lib/server/handoff";
import { PostgresPersistence } from "@/lib/server/repositories";
import { createIncidentService } from "./index";
import { handleAckRequest, type AckHttpDeps } from "./http";

let cached: AckHttpDeps | undefined;
/** Ensamblado perezoso: el pool y la configuración se leen en la primera petición, no al importar (build sin DB). */
function deps(): AckHttpDeps {
  if (!cached) {
    const store = new PostgresPersistence(getDb());
    cached = {
      authorization: createPersistedAuthorization(store),
      service: createIncidentService({ store, handoff: createHandoffService({ store }) }),
      validator: createRequestValidator(), now: () => new Date().toISOString() as ReturnType<AckHttpDeps["now"]>,
    };
  }
  return cached;
}
export const ackRoute = (request: Request, params: unknown) => handleAckRequest(deps(), request, params);
