import "server-only";
import { buildRecipientGrant } from "@/lib/server/auth/service";
import type { CommandContext } from "@/lib/contracts/auth";
import type { NotificationIntent } from "@/lib/contracts/domain";
import type { UnitOfWork } from "@/lib/contracts/repositories";
import type { NotificationDeliveryResult, NotificationTransport } from "@/lib/contracts/services";
import type { NtfyConfig } from "./config";
import { handoffMessage, incidentMessage, type NtfyMessage } from "./format";
import { resolveTarget } from "./target";

/** `enabled=false`: el despachador no lo usa y la intención sigue pendiente; nunca se simula aceptación. */
export interface GatedTransport extends NotificationTransport { readonly enabled: boolean }

export interface NtfyDeps {
  readonly config: NtfyConfig | null;
  readonly uow: UnitOfWork;
  readonly fetch?: typeof fetch;
}

type Prepared =
  | { readonly stale: "attempt" }
  | { readonly stale: null; readonly message: NtfyMessage };

function failed(reason: "unavailable" | "timeout" | "rejected", retryable: boolean): NotificationDeliveryResult {
  return { kind: "failed", reason, retryable };
}

/** Respuesta del proveedor reducida a códigos: sin cuerpo, URL, cabeceras ni tópico. */
async function readProviderId(response: Response): Promise<string | null> {
  try {
    const value: unknown = await response.json();
    const id = (value as { id?: unknown } | null)?.id;
    return typeof id === "string" && id.length <= 64 ? id : null;
  } catch { return null; }
}

export function createNtfyTransport(deps: NtfyDeps): GatedTransport {
  const send = deps.fetch ?? fetch;
  const config = deps.config;
  return {
    enabled: config !== null,
    async deliver(context: CommandContext, intent: NotificationIntent, signal?: AbortSignal): Promise<NotificationDeliveryResult> {
      if (!config) return failed("unavailable", false);
      // 1) TX corta: revalida y emite la concesión. Ninguna llamada externa mantiene locks.
      const prepared = await deps.uow.run<Prepared>(context, async tx => {
        const target = await resolveTarget(tx, intent);
        if (!target || target.kind === "coordination") return { ok: true, value: { stale: "attempt" } };
        const issued = buildRecipientGrant(context, intent.recipientActorId, target.scope);
        if (!issued.ok) return issued;
        await tx.credentials.saveGrant(issued.value.grant);
        const token = issued.value.opaqueToken;
        const message = target.kind === "handoff"
          ? handoffMessage(config.appOrigin, target.handoffId, token)
          : incidentMessage(target.headline, {
            appOrigin: config.appOrigin, incidentId: target.incidentId, attemptId: target.scope.attemptId,
            executionId: context.executionId, expectedVersion: target.version, notificationId: intent.id, token,
          });
        return { ok: true, value: { stale: null, message } };
      });
      if (!prepared.ok) return prepared.code === "EXECUTION_STALE" ? { kind: "discarded", reason: "stale_execution" } : failed("unavailable", true);
      if (prepared.value.stale) return { kind: "discarded", reason: "stale_attempt" };
      // 2) HTTP fuera de transacción, con tiempo máximo propio y cancelación externa.
      const timeout = AbortSignal.timeout(config.timeoutMs);
      const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      try {
        const response = await send(config.baseUrl, {
          method: "POST", redirect: "error", signal: combined,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: config.topic, ...prepared.value.message }),
        });
        if (response.ok) {
          return { kind: "provider_accepted", acceptedAt: context.operationalNow, providerMessageId: await readProviderId(response) };
        }
        return response.status >= 500 || response.status === 429 ? failed("unavailable", true) : failed("rejected", false);
      } catch {
        return timeout.aborted && !signal?.aborted ? failed("timeout", true) : failed("unavailable", true);
      }
    },
  };
}
