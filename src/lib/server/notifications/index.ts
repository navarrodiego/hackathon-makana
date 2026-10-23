import "server-only";
import type { UnitOfWork } from "@/lib/contracts/repositories";
import type { NotificationService } from "@/lib/contracts/services";
import { readNtfyConfig } from "./config";
import { createNotificationService } from "./dispatcher";
import { createInAppTransport } from "./in-app";
import { createNtfyTransport } from "./ntfy";

export { createNotificationService, MAX_FAILURES, RETRY_SPACING_MS } from "./dispatcher";
export { createInAppTransport } from "./in-app";
export { createNtfyTransport, type GatedTransport } from "./ntfy";
export { readNtfyConfig, type NtfyConfig, type NtfyState } from "./config";

/** Composición por defecto para T11: configuración privada del entorno; envío real solo con NTFY_ENABLED=true. */
export function createDefaultNotificationService(uow: UnitOfWork): NotificationService {
  const state = readNtfyConfig();
  return createNotificationService({
    uow, transports: { ntfy: createNtfyTransport({ config: state.state === "ready" ? state.config : null, uow }), in_app: createInAppTransport() },
  });
}
