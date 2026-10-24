import { LIMITS, type Id } from "@/lib/contracts/core";
import { BASE_FIXTURE } from "@/lib/contracts/fixtures";
import type { ApiRoutes, RequestValidator, RouteKey, ServiceResult } from "@/lib/contracts/http";

type Obj = Record<string, unknown>;
type Parsed<K extends RouteKey> = { readonly input: ApiRoutes[K]["input"]; readonly params: ApiRoutes[K]["params"] };

const ID_BODY = /^[A-Za-z0-9_-]{1,64}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._-]{1,128}$/;
// Controles salvo salto de línea y tabulación, más separadores y marcas bidireccionales invisibles.
const FORBIDDEN_TEXT = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2066-\u2069\uFEFF]/u;
const NICKNAME_MAX = 40;
/** Una decisión por pendiente del escenario. */
const TICKETS_PER_HANDOFF = BASE_FIXTURE.tickets.length;
const REASON_MAX = 280;

class Invalid extends Error {}
const invalid = (): never => { throw new Invalid(); };

function record(value: unknown, keys: readonly string[], optional: readonly string[] = []): Obj {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const o = value as Obj;
  for (const k of Object.keys(o)) if (!keys.includes(k) && !optional.includes(k)) invalid();
  for (const k of keys) if (!(k in o)) invalid();
  return o;
}
function id<P extends string>(value: unknown, prefix: P): Id<P> {
  if (typeof value !== "string" || !value.startsWith(`${prefix}_`)) return invalid();
  const rest = value.slice(prefix.length + 1);
  // handoff_attempt_ no debe aceptarse como handoff_: el resto tampoco empieza con otro prefijo conocido.
  if (!ID_BODY.test(rest) || (prefix === "handoff" && rest.startsWith("attempt_")) || (prefix === "incident" && rest.startsWith("attempt_"))) return invalid();
  return value as Id<P>;
}
const codePoints = (s: string) => Array.from(s).length;
function text(value: unknown, max: number): string {
  if (typeof value !== "string") return invalid();
  const t = value.trim();
  if (!t || codePoints(t) > max || FORBIDDEN_TEXT.test(t)) return invalid();
  return t;
}
function mutation(o: Obj) {
  const key = o.idempotencyKey;
  if (typeof key !== "string" || !IDEMPOTENCY_KEY.test(key)) invalid();
  return { executionId: id(o.executionId, "execution"), idempotencyKey: key as string };
}
function versioned(o: Obj) {
  const v = o.expectedVersion;
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 1) invalid();
  return { ...mutation(o), expectedVersion: v as number };
}
const MUTATION = ["executionId", "idempotencyKey"] as const;
const VERSIONED = [...MUTATION, "expectedVersion"] as const;
function represented(o: Obj) {
  return o.representedActorId === undefined ? {} : { representedActorId: id(o.representedActorId, "actor") };
}
function words(note: unknown): string {
  if (typeof note !== "string") return invalid();
  const t = note.trim();
  if (FORBIDDEN_TEXT.test(t) || (t ? t.split(/\s+/u).length : 0) > LIMITS.noteWords) return invalid();
  return t;
}
function routeId<P extends "handoff" | "incident">(params: unknown, prefix: P): { id: Id<P> } {
  return { id: id(record(params, ["id"]).id, prefix) };
}

const PARSERS: { [K in RouteKey]: (body: unknown, params: unknown) => Parsed<K> } = {
  "GET /api/state": (body, params) => {
    if (body !== null || params !== null) invalid();
    return { input: null, params: null };
  },
  "POST /api/messages": body => {
    const o = record(body, [...MUTATION, "nickname", "text"]);
    return { input: { ...mutation(o), nickname: text(o.nickname, NICKNAME_MAX), text: text(o.text, LIMITS.reportCharacters) }, params: null };
  },
  "POST /api/handoff": body => {
    const o = record(body, [...VERSIONED, "handoffId", "note", "tickets"], ["representedActorId"]);
    if (!Array.isArray(o.tickets) || o.tickets.length !== TICKETS_PER_HANDOFF) invalid();
    const tickets = (o.tickets as unknown[]).map(item => {
      const t = record(item, ["ticketId", "disposition", "reason"]);
      if (t.disposition !== "puede_esperar" && t.disposition !== "transferir") invalid();
      return { ticketId: id(t.ticketId, "ticket"), disposition: t.disposition as "puede_esperar" | "transferir", reason: text(t.reason, REASON_MAX) };
    });
    if (new Set(tickets.map(t => t.ticketId)).size !== tickets.length) invalid();
    return { input: { ...versioned(o), ...represented(o), handoffId: id(o.handoffId, "handoff"), note: words(o.note), tickets }, params: null };
  },
  "POST /api/handoff/suggest": body => {
    const o = record(body, [...VERSIONED, "handoffId"], ["representedActorId"]);
    return { input: { ...versioned(o), ...represented(o), handoffId: id(o.handoffId, "handoff") }, params: null };
  },
  "POST /api/handoff/[id]/accept": (body, params) => respondHandoff(body, params),
  "POST /api/handoff/[id]/reject": (body, params) => respondHandoff(body, params),
  "POST /api/ack/[id]": (body, params) => {
    const o = record(body, [...VERSIONED, "attemptId"], ["representedActorId"]);
    return { input: { ...versioned(o), ...represented(o), attemptId: id(o.attemptId, "incident_attempt") }, params: routeId(params, "incident") };
  },
  "POST /api/scene": body => {
    const o = record(body, [...VERSIONED, "sceneId", "channelOpen"]);
    if (typeof o.channelOpen !== "boolean") invalid();
    return { input: { ...versioned(o), sceneId: id(o.sceneId, "scene"), channelOpen: o.channelOpen as boolean }, params: null };
  },
  "POST /api/reset": body => ({ input: versioned(record(body, VERSIONED)), params: null }),
};
function respondHandoff(body: unknown, params: unknown) {
  const o = record(body, [...VERSIONED, "attemptId"], ["representedActorId"]);
  return { input: { ...versioned(o), ...represented(o), attemptId: id(o.attemptId, "handoff_attempt") }, params: routeId(params, "handoff") };
}

/** Valida forma, formato y límites de formato; permisos y existencia son de auth y de los motores. `raw` = { body, params }. */
export function createRequestValidator(): RequestValidator {
  return {
    parse<K extends RouteKey>(route: K, raw: unknown): ServiceResult<Parsed<K>> {
      try {
        const { body, params } = record(raw, ["body", "params"]);
        return { ok: true, value: (PARSERS[route] as (b: unknown, p: unknown) => Parsed<K>)(body, params) };
      } catch (error) {
        if (error instanceof Invalid) return { ok: false, code: "INVALID_INPUT" };
        throw error;
      }
    },
  };
}
