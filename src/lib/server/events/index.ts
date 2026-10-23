import "server-only";
import { randomUUID } from "node:crypto";
import type { CommandContext } from "@/lib/contracts/auth";
import type { ActorId, Channel, NotificationId } from "@/lib/contracts/core";
import type { Event, EventDetails, EventPrincipal, NotificationIntent, NotificationSubject } from "@/lib/contracts/domain";
import type { TransactionRepositories } from "@/lib/contracts/repositories";
import type { EventService } from "@/lib/contracts/services";

export type EventInput = Pick<Event, "kind" | "entity" | "entityVersion" | "channel" | "details" | "result">;

const EVENT_KEYS = ["executionId", "kind", "entity", "entityVersion", "actorId", "principal", "origin", "channel", "details", "operationalAt", "narrativeAt", "correlationId", "result"];
const INPUT_KEYS = ["kind", "entity", "entityVersion", "channel", "details", "result"];
// Lista cerrada por tipo de detalle: sin texto libre del reporte, credenciales ni entidades completas (S03).
const DETAIL_KEYS: Record<EventDetails["kind"], readonly string[]> = {
  transition: ["kind", "from", "to"], classification: ["kind", "mode", "reason"], policy: ["kind", "decision"],
  notification: ["kind", "providerMessageId", "failure"], record: ["kind"],
};

function onlyKeys(value: object, allowed: readonly string[], what: string) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Campo no permitido en ${what}: ${key}`);
}
function checkInput(input: Pick<Event, "entityVersion" | "details">) {
  if (!Number.isSafeInteger(input.entityVersion) || input.entityVersion < 1) throw new Error("La versión de la entidad debe ser un entero desde 1.");
  const keys = DETAIL_KEYS[input.details.kind];
  if (!keys) throw new Error("Detalle de evento no permitido.");
  onlyKeys(input.details, keys, "detalle de evento");
}

/** El principal del evento nunca incluye la concesión: solo quién actuó. */
export function eventPrincipal(context: CommandContext): EventPrincipal {
  const p = context.principal;
  switch (p.kind) {
    case "outgoing": case "recipient": return { kind: "actor", actorId: p.actorId };
    case "control": return { kind: "control", operatorId: p.operatorId };
    case "reporter": return { kind: "reporter", sessionId: p.sessionId };
    case "system": return { kind: "system" };
  }
}

function fromContext(context: CommandContext, input: EventInput): Omit<Event, "id" | "sequence"> {
  return {
    executionId: context.executionId, kind: input.kind, entity: input.entity, entityVersion: input.entityVersion,
    actorId: context.actorId, principal: eventPrincipal(context), origin: context.origin, channel: input.channel,
    details: input.details, operationalAt: context.operationalNow, narrativeAt: context.narrativeNow,
    correlationId: context.correlationId, result: input.result,
  };
}

/**
 * Escribe dentro de la transacción del consumidor: el evento se confirma o revierte con la transición.
 * El llamador no registra éxitos antes de su commit ni fuera de esa unidad de trabajo.
 */
export async function recordEvent(transaction: TransactionRepositories, context: CommandContext, input: EventInput): Promise<Event> {
  onlyKeys(input, INPUT_KEYS, "evento");
  checkInput(input);
  return transaction.events.append(fromContext(context, input));
}

export function createEventService(): EventService<TransactionRepositories> {
  return {
    async append(transaction, context, event) {
      onlyKeys(event, EVENT_KEYS, "evento");
      checkInput(event);
      const expected = fromContext(context, event);
      const keys = ["executionId", "actorId", "origin", "correlationId", "operationalAt", "narrativeAt"] as const;
      if (keys.some(k => event[k] !== expected[k]) || JSON.stringify(event.principal) !== JSON.stringify(expected.principal)) {
        throw new Error("El evento no coincide con el contexto de la operación.");
      }
      await transaction.events.append(event);
    },
  };
}

/** Clave determinista: un mismo aviso lógico no se duplica por reintentos ni por carreras. */
export function logicalKeyFor(subject: NotificationSubject, recipientActorId: ActorId, channel: NotificationIntent["channel"]): string {
  const who = subject.kind === "coordination" ? `coordination:${subject.entity.kind}:${subject.entity.id}` : `${subject.kind}:${subject.id}:${subject.attemptId}`;
  return `${who}|${recipientActorId}|${channel}`;
}

export interface IntentInput {
  readonly subject: NotificationSubject;
  readonly recipientActorId: ActorId;
  readonly channel: NotificationIntent["channel"];
}
/** Registra la intención (no el envío). Devuelve la existente si la clave lógica ya estaba registrada. */
export async function registerNotificationIntent(transaction: TransactionRepositories, context: CommandContext, input: IntentInput):
  Promise<{ readonly created: boolean; readonly intent: NotificationIntent }> {
  const logicalKey = logicalKeyFor(input.subject, input.recipientActorId, input.channel);
  const existing = (await transaction.aggregates.notifications.list()).find(n => n.logicalKey === logicalKey);
  if (existing) return { created: false, intent: existing };
  const intent: NotificationIntent = {
    executionId: context.executionId, version: 1, id: `notification_${randomUUID()}` as NotificationId, subject: input.subject,
    recipientActorId: input.recipientActorId, channel: input.channel, logicalKey, status: "pending", createdAt: context.operationalNow,
  };
  await transaction.aggregates.notifications.insert(intent);
  const channel: Channel = input.channel;
  await recordEvent(transaction, context, {
    kind: "notification_intended", entity: { kind: "notification", id: intent.id }, entityVersion: intent.version,
    channel, details: { kind: "record" }, result: "recorded",
  });
  return { created: true, intent };
}
