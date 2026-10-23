import "server-only";
import { getDb } from "@/lib/server/db";
import { createPersistedAuthorization } from "@/lib/server/auth/persistence";
import { createRequestValidator } from "@/lib/server/http/validate";
import { PostgresPersistence } from "@/lib/server/repositories";
import { createHandoffService } from "./index";
import { handleHandoffRequest, type HandoffHttpDeps, type HandoffRoute } from "./http";

let cached: HandoffHttpDeps | undefined;
/** Ensamblado perezoso: el pool y la configuración se leen en la primera petición, no al importar (build sin DB). */
function deps() {
  if (!cached) {
    const store = new PostgresPersistence(getDb());
    cached = {
      store, authorization: createPersistedAuthorization(store), service: createHandoffService({ store }),
      validator: createRequestValidator(), now: () => new Date().toISOString() as ReturnType<HandoffHttpDeps["now"]>,
    };
  }
  return cached;
}
export const handoffRoute = (route: HandoffRoute, request: Request, params: unknown) => handleHandoffRequest(deps(), route, request, params);
