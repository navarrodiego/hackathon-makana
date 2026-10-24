import assert from "node:assert/strict";
import { test } from "node:test";
import { cierre } from "../../src/components/proyector/cierre";
import { closingSummary } from "../../src/lib/server/handoff/dto";

const rodrigo = { id: "actor_outgoing", displayName: "Rodrigo" } as never;
const paula = { id: "actor_incoming", displayName: "Paula" } as never;
const closing = (pendingCount: number, followUpCount: number) => ({ outgoing: rodrigo, firstCandidate: paula, pendingCount, followUpCount });

test("cierre en el proyector: quién cierra, cuántos deja y a quién irá, en singular y plural", () => {
  const end = "2026-10-24T01:10:00.000Z", before = "2026-10-24T01:09:50.000Z", after = "2026-10-24T01:10:05.000Z";
  assert.deepEqual(cierre(closing(5, 1), end, before), {
    titulo: "Rodrigo cierra su turno",
    pendientes: "Deja 5 pendientes a quien entra; 1 queda para seguimiento.",
    siguiente: "Su turno termina a las 22:10. El relevo irá primero a Paula; aún no se envía.",
  });
  assert.equal(cierre(closing(5, 1), end, after).siguiente, "Su turno terminó a las 22:10. El relevo irá primero a Paula; aún no se envía.",
    "con la hora ya pasada no se habla en futuro");
  assert.equal(cierre(closing(1, 2), null, before).pendientes, "Deja 1 pendiente a quien entra; 2 quedan para seguimiento.");
  assert.equal(cierre(closing(3, 0), null, before).pendientes, "Deja 3 pendientes a quien entra.");
  assert.equal(cierre(closing(3, 0), null, before).siguiente, "El relevo irá primero a Paula; aún no se envía.");
});

const ticket = (id: string, disposition: string) => ({ id, disposition }) as never;
const handoff = (over: object = {}) => ({
  status: "draft", outgoingActorId: "actor_outgoing", ticketIds: ["t1", "t2", "t3"], savedSuggestion: null, ...over,
}) as never;
const window = { incomingActorId: "actor_incoming" } as never;
const actors = [rodrigo, paula] as never;

test("resumen del cierre: la propuesta guardada manda sobre la decisión base y solo hay conteos", () => {
  const tickets = [ticket("t1", "transferir"), ticket("t2", "puede_esperar"), ticket("t3", "puede_esperar")];
  assert.deepEqual(closingSummary(handoff(), window, tickets, actors), {
    outgoing: rodrigo, firstCandidate: paula, pendingCount: 3, followUpCount: 1,
  });
  const saved = { output: { suggestions: [
    { ticketId: "t1", disposition: "puede_esperar" }, { ticketId: "t2", disposition: "transferir" }, { ticketId: "t3", disposition: "transferir" },
  ] } };
  assert.equal(closingSummary(handoff({ savedSuggestion: saved }), window, tickets, actors)?.followUpCount, 2);
});

test("resumen del cierre: desaparece en cuanto el relevo se envía", () => {
  assert.equal(closingSummary(handoff({ status: "awaiting_candidate" }), window, [], actors), null);
});
