import "server-only";
import type { CommandContext } from "@/lib/contracts/auth";
import type { NotificationIntent } from "@/lib/contracts/domain";
import type { UnitOfWork } from "@/lib/contracts/repositories";
import type { NotificationDeliveryResult, NotificationService } from "@/lib/contracts/services";
import { recordEvent } from "@/lib/server/events";
import { resolveTarget } from "./target";
import type { GatedTransport } from "./ntfy";

export const MAX_FAILURES = 3;
export const RETRY_SPACING_MS = 2_000;

export interface DispatcherDeps {
  readonly uow: UnitOfWork;
  readonly transports: { readonly ntfy: GatedTransport; readonly in_app: GatedTransport };
}

/**
 * Convierte intenciones pendientes en resultados observables. La entrega ocurre fuera de toda
 * transacción; el resultado se guarda en otra solo si la ejecución y el intento siguen vigentes.
 * No garantiza una única entrega externa: un HTTP ya enviado no se puede retirar.
 */
export function createNotificationService(deps: DispatcherDeps): NotificationService {
  const inFlight = new Set<string>();

  async function record(context: CommandContext, intent: NotificationIntent, result: NotificationDeliveryResult): Promise<boolean> {
    const saved = await deps.uow.run<boolean>(context, async tx => {
      const current = await tx.aggregates.notifications.get(intent.id);
      if (!current || current.status !== "pending") return { ok: true, value: false };
      const guard = { executionId: current.executionId, version: current.version, status: "pending" as const };
      const finish = (status: NotificationIntent["status"]) =>
        tx.aggregates.notifications.compareAndSwap({ ...current, status, version: current.version + 1 }, guard);
      const target = await resolveTarget(tx, current);
      if (!target || result.kind === "discarded") {
        await finish("discarded");
        return { ok: true, value: false };
      }
      const entity = { kind: "notification", id: current.id } as const;
      const channel = current.channel;
      if (result.kind === "provider_accepted") {
        if (!await finish("provider_accepted")) return { ok: true, value: false };
        await recordEvent(tx, context, { kind: "notification_provider_accepted", entity, entityVersion: current.version + 1, channel,
          details: { kind: "notification", providerMessageId: result.providerMessageId, failure: null }, result: "provider_accepted" });
        return { ok: true, value: true };
      }
      if (result.kind === "in_app_recorded") {
        if (!await finish("in_app_recorded")) return { ok: true, value: false };
        await recordEvent(tx, context, { kind: "notification_in_app", entity, entityVersion: current.version + 1, channel,
          details: { kind: "notification", providerMessageId: null, failure: null }, result: "recorded" });
        return { ok: true, value: true };
      }
      const failures = (await tx.events.list()).filter(e => e.kind === "notification_failed" && e.entity.kind === "notification" && e.entity.id === current.id).length + 1;
      const terminal = !result.retryable || failures >= MAX_FAILURES;
      if (terminal && !await finish("failed")) return { ok: true, value: false };
      await recordEvent(tx, context, { kind: "notification_failed", entity, entityVersion: terminal ? current.version + 1 : current.version, channel,
        details: { kind: "notification", providerMessageId: null, failure: result.reason }, result: "failed" });
      return { ok: true, value: true };
    });
    return saved.ok && saved.value;
  }

  return {
    async dispatchPending(context) {
      const due = await deps.uow.run<readonly NotificationIntent[]>(context, async tx => {
        const events = await tx.events.list();
        const now = Date.parse(context.operationalNow);
        const lastFailure = (id: string) => events.filter(e => e.kind === "notification_failed" && e.entity.id === id).reduce((m, e) => Math.max(m, Date.parse(e.operationalAt)), 0);
        const pending = (await tx.aggregates.notifications.list())
          .filter(n => n.status === "pending" && deps.transports[n.channel].enabled && now - lastFailure(n.id) >= RETRY_SPACING_MS);
        return { ok: true, value: pending };
      });
      if (!due.ok) return due;
      const results = await Promise.all(due.value.map(async intent => {
        const key = `${intent.executionId}:${intent.id}`;
        if (inFlight.has(key)) return false;
        inFlight.add(key);
        try {
          const result = await deps.transports[intent.channel].deliver(context, intent);
          return await record(context, intent, result);
        } catch {
          return false;
        } finally {
          inFlight.delete(key);
        }
      }));
      return { ok: true, value: results.filter(Boolean).length };
    },
  };
}
