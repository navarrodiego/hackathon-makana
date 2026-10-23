/** Pruebas estáticas: compilación rechaza mezclas; no prueban validación runtime. */
import type { ApiFailure, ApiRoutes, RespondHandoff, TakeIncident } from "./http";
import type { IncidentStatus } from "./core";
import type { HandoffPackageDTO } from "./private";
import type { PublicStateDTO } from "./client";
import { pageExamples, publicStateExample } from "./examples";

// @ts-expect-error Una vista privada no es una proyección pública.
export const privateAsPublic: PublicStateDTO = pageExamples["/relevo/[id]"];
// @ts-expect-error Una proyección pública no contiene el paquete de relevo.
export const publicAsPrivate: HandoffPackageDTO = publicStateExample;
// @ts-expect-error Tomar no agrega resolución al alcance.
export const resolved: IncidentStatus = "resolved";
// @ts-expect-error Un intento de incidente no sirve para responder un relevo.
export const wrongAttempt: RespondHandoff = { executionId: "execution_x", idempotencyKey: "x", expectedVersion: 1, attemptId: "incident_attempt_x" };
// @ts-expect-error Acuse requiere versión e intento vigentes.
export const incompleteAck: TakeIncident = { executionId: "execution_x", idempotencyKey: "x" };
// @ts-expect-error GET state no acepta comandos de actor.
export const getMutation: ApiRoutes["GET /api/state"]["input"] = { action: "accept" };
// @ts-expect-error El status de credencial vencida es 401, no un éxito.
export const wrongError: ApiFailure<"AUTH_EXPIRED"> = { status: 200, body: { ok: false, error: { code: "AUTH_EXPIRED", message: "El enlace venció." }, correlationId: "correlation_x" } };
export const publicWithSecret: PublicStateDTO = {
  ...publicStateExample,
  // @ts-expect-error El estado público no admite tokens.
  token: "not-a-credential",
};
// @ts-expect-error La entrada cliente no exporta entidades privadas.
export type PrivateEntityFromClient = import("./client").Handoff;
// @ts-expect-error La entrada cliente no exporta vistas privadas.
export type PrivateViewFromClient = import("./client").HandoffPackageDTO;
// @ts-expect-error La entrada cliente no exporta concesiones de token.
export type GrantFromClient = import("./client").RecipientGrant;

// @ts-expect-error Una cobertura activa exige una persona confirmada.
export const activeWithoutActor: import("./public").CoverageDTO = { ...publicStateExample.coverage, status: "active", actor: null };
