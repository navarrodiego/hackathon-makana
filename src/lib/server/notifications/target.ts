import "server-only";
import type { HandoffId, IncidentId, Service, Version } from "@/lib/contracts/core";
import type { NotificationIntent } from "@/lib/contracts/domain";
import type { RecipientScope } from "@/lib/contracts/auth";
import type { TransactionRepositories } from "@/lib/contracts/repositories";
import type { IncidentHeadline } from "./format";

export type Target =
  | { readonly kind: "handoff"; readonly handoffId: HandoffId; readonly scope: Extract<RecipientScope, { entity: "handoff" }> }
  | { readonly kind: "incident"; readonly incidentId: IncidentId; readonly version: Version; readonly headline: IncidentHeadline; readonly scope: Extract<RecipientScope, { entity: "incident" }> }
  | { readonly kind: "coordination" };

/**
 * Revalida que el aviso siga vigente: intento actual, pendiente y dirigido a ese destinatario.
 * null = obsoleto. La vigencia de la ejecución la garantiza la unidad de trabajo.
 */
export async function resolveTarget(tx: TransactionRepositories, intent: NotificationIntent): Promise<Target | null> {
  const subject = intent.subject;
  if (subject.kind === "coordination") return { kind: "coordination" };
  if (subject.kind === "handoff") {
    const handoff = await tx.aggregates.handoffs.get(subject.id);
    const attempt = await tx.aggregates.handoffAttempts.get(subject.attemptId);
    if (!handoff || !attempt || handoff.status !== "awaiting_candidate" || handoff.currentAttemptId !== subject.attemptId
      || attempt.status !== "pending" || attempt.candidateActorId !== intent.recipientActorId) return null;
    return { kind: "handoff", handoffId: handoff.id, scope: {
      entity: "handoff", entityId: handoff.id, attemptId: attempt.id, actions: ["read_handoff", "accept_handoff", "reject_handoff"],
    } };
  }
  const incident = await tx.aggregates.incidents.get(subject.id);
  const attempt = await tx.aggregates.incidentAttempts.get(subject.attemptId);
  if (!incident || !attempt || incident.status !== "awaiting_ack" || incident.currentAttemptId !== subject.attemptId
    || attempt.status !== "pending" || attempt.candidateActorId !== intent.recipientActorId) return null;
  const key = incident.equivalence;
  const headline: IncidentHeadline = key.mode === "facts"
    ? { service: key.service as Service, condition: key.condition } : { service: null, condition: null };
  return { kind: "incident", incidentId: incident.id, version: incident.version, headline, scope: {
    entity: "incident", entityId: incident.id, attemptId: attempt.id, actions: ["take_incident"],
  } };
}
