import "server-only";
import type { CommandContext } from "@/lib/contracts/auth";
import type { ActorId, Channel, HandoffAttemptId, HandoffId } from "@/lib/contracts/core";
import type { TransactionRepositories } from "@/lib/contracts/repositories";
import { registerNotificationIntent } from "@/lib/server/events";

/** Solo registra intención (C07/C10). El transporte (T08) y sus tokens no se tocan aquí. */
export function noticeForAttempt(tx: TransactionRepositories, context: CommandContext, handoffId: HandoffId, attemptId: HandoffAttemptId, recipient: ActorId, position: number) {
  // C09: el primer candidato recibe ntfy; los derivados se representan in-app.
  return registerNotificationIntent(tx, context, { subject: { kind: "handoff", id: handoffId, attemptId }, recipientActorId: recipient, channel: position === 0 ? "ntfy" : "in_app" });
}
export function noticeForCoordination(tx: TransactionRepositories, context: CommandContext, handoffId: HandoffId, coordinator: ActorId) {
  return registerNotificationIntent(tx, context, { subject: { kind: "coordination", entity: { kind: "handoff", id: handoffId } }, recipientActorId: coordinator, channel: "in_app" });
}
export function eventChannel(context: CommandContext): Channel {
  return context.origin === "ntfy_action" ? "ntfy" : context.origin === "system" ? "system" : "web";
}
