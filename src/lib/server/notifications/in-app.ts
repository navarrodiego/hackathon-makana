import "server-only";
import type { NotificationDeliveryResult } from "@/lib/contracts/services";
import type { GatedTransport } from "./ntfy";

/** Representación en pantalla de Tomás/Carla. Registra un hecho de escenario; no es un push físico. */
export function createInAppTransport(): GatedTransport {
  return {
    enabled: true,
    async deliver(context): Promise<NotificationDeliveryResult> {
      return { kind: "in_app_recorded", recordedAt: context.operationalNow };
    },
  };
}
