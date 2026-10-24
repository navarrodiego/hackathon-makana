import type { AsyncFence, TicketId } from "../../../src/lib/contracts/core";
import type { NoteOutput, ProviderRequest } from "../../../src/lib/contracts/classification";
import { BASE_FIXTURE } from "../../../src/lib/contracts/fixtures";

export const fence: AsyncFence = {
  executionId: "execution_t02", version: 1, correlationId: "correlation_t02",
  entity: { kind: "report", id: "report_t02" },
};
export const classifyRequest = {
  task: "classification", input: { text: "Local 7: caja 2 no emite boletas." }, fence,
} as const satisfies ProviderRequest;
export const noteRequest = {
  task: "note", input: { tickets: BASE_FIXTURE.tickets, receiverName: "Paula", policyVersion: "C05-v1" },
  fence: { ...fence, entity: { kind: "handoff", id: "handoff_t02" } },
} as const satisfies ProviderRequest;
export const evidence = { location: "Local 7", resource: "caja 2", problem: "no emite boletas" };
export const note = {
  suggestions: BASE_FIXTURE.tickets.map(({ id, disposition }) => ({ ticketId: id as TicketId, disposition, reason: "Pendiente de seguimiento." })),
  note: "Revisa el próximo intento de respaldo a las 02:00. Los demás pendientes pueden esperar.",
} satisfies NoteOutput;
const choice = (value: string, labels: string[]) => ({
  type: "choice", choice: value, confidence: 0.9,
  probabilities: Object.fromEntries(labels.map(label => [label, label === value ? 1 : 0])),
});
export function decisions() {
  return {
    id: "gen-test", model: "typesafe/jev-1.14-20261014", provider: "TypeSafe", usage: { cost: 0.00001 },
    answers: {
      service: choice("facturacion", ["facturacion", "red_locales", "correo", "vpn", "impresora", "cuentas", "otro"]),
      condition: choice("caida", ["caida", "degradacion", "solicitud"]),
      scope: choice("local_equipo", ["persona", "local_equipo", "generalizado"]),
      manipulation: choice("false", ["true", "false"]),
      blocksBilling: choice("true", ["true", "false", "unknown"]),
      sufficientInformation: choice("true", ["true", "false"]),
      topic: choice("ti", ["ti", "no_ti", "dudoso"]),
      physicalEmergency: choice("false", ["true", "false"]),
      pc: { type: "noul", noul: 0.85 },
    },
  };
}
export function chat(output: unknown) {
  return { id: "gen-chat", model: "deepseek/deepseek-v4.1-flash-20261017", choices: [
    { message: { role: "assistant", content: JSON.stringify(output) }, finish_reason: "stop" },
  ], usage: { cost: 0.00002 } };
}
export function transport(onRequest?: (url: string, body: Record<string, unknown>, init: RequestInit) => void): typeof fetch {
  return async (url, init) => {
    const body = JSON.parse(String(init?.body));
    onRequest?.(String(url), body, init!);
    return Response.json(String(url).endsWith("/decisions") ? decisions() : chat(evidence));
  };
}

// Las pruebas de datos no dependen de la carga de CPU; lifecycle verifica los plazos.
export const stableTiming = { now: () => 0, schedule: () => () => {} };
