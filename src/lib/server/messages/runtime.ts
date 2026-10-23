import "server-only";
import type { Instant } from "@/lib/contracts/core";
import type { AuthorizationService } from "@/lib/contracts/auth";
import type { PublicSessionService } from "@/lib/contracts/auth";
import type { ReadService } from "@/lib/contracts/services";
import { createPersistedAuthorization } from "@/lib/server/auth/persistence";
import { createClassificationService } from "@/lib/server/classification";
import { getDb } from "@/lib/server/db";
import { createHandoffService } from "@/lib/server/handoff";
import { createRequestValidator } from "@/lib/server/http/validate";
import { createIncidentService } from "@/lib/server/incidents";
import { policyService } from "@/lib/server/policy";
import { createOpenRouterProvider } from "@/lib/server/providers/openrouter";
import { PostgresPersistence } from "@/lib/server/repositories";
import { createReadService } from "@/lib/server/state";
import { handleMessageRequest, type MessageHttpDeps } from "./http";
import { createMessageService } from "./index";
import { createPublicSessionService } from "./session";

interface Runtime extends MessageHttpDeps {
  readonly sessions: PublicSessionService;
  readonly read: ReadService;
  readonly authorization: AuthorizationService;
  readonly store: PostgresPersistence;
}
let cached: Runtime | undefined;

/** Ensamblado perezoso: pool, proveedor y secretos se leen en la primera petición, no al importar (build sin DB). */
export function runtime(): Runtime {
  if (!cached) {
    const store = new PostgresPersistence(getDb());
    const handoff = createHandoffService({ store });
    cached = {
      store, authorization: createPersistedAuthorization(store), validator: createRequestValidator(),
      service: createMessageService({
        store, classification: createClassificationService({ provider: createOpenRouterProvider() }),
        policy: policyService, incidents: createIncidentService({ store, handoff }),
      }),
      sessions: createPublicSessionService({ store }),
      read: createReadService({ store, now: () => new Date().toISOString() as Instant }),
    };
  }
  return cached;
}

export const messageRoute = (request: Request) => handleMessageRequest(runtime(), request);
