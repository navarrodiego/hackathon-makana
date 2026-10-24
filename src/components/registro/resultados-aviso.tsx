import type { PublicStateDTO } from "@/lib/contracts/client";

export interface NoticeTally {
  readonly ntfyAccepted: number;
  readonly inAppRecorded: number;
  readonly failed: number;
  readonly pending: number;
  readonly taken: number;
  readonly scenarioEvents: number;
}

/** Conteos derivados solo del registro y de las intenciones de aviso; no mezcla envío, acuse y origen. */
export function tallyNotices(state: Pick<PublicStateDTO, "notifications" | "incidents" | "events">): NoticeTally {
  const n = state.notifications;
  return {
    ntfyAccepted: n.filter(x => x.channel === "ntfy" && x.status === "provider_accepted").length,
    inAppRecorded: n.filter(x => x.channel === "in_app" && x.status === "in_app_recorded").length,
    failed: n.filter(x => x.status === "failed").length,
    pending: n.filter(x => x.status === "pending").length,
    taken: state.incidents.filter(i => i.takenBy !== null).length,
    scenarioEvents: state.events.filter(e => e.origin === "scenario").length,
  };
}

export function ResultadosAviso({ state }: { state: PublicStateDTO }) {
  const t = tallyNotices(state);
  const rows: [string, number, string][] = [
    ["Envíos aceptados por ntfy", t.ntfyAccepted, "El proveedor lo aceptó; no prueba que el teléfono lo recibió."],
    ["Avisos in-app registrados", t.inAppRecorded, "Representación en pantalla; no es un dispositivo físico."],
    ["Avisos fallidos", t.failed, "Falló el envío; no hay recepción."],
    ["Avisos pendientes", t.pending, "Intención registrada, sin resultado todavía."],
    ["Incidentes tomados", t.taken, "Alguien asumió atender; no significa resuelto."],
    ["Eventos de origen escenario", t.scenarioEvents, "Acciones hechas desde el control de la demostración."],
  ];
  return (
    <section aria-labelledby="avisos-titulo" className="flex flex-col gap-2">
      <h2 id="avisos-titulo" className="text-section font-semibold">Resultados de aviso</h2>
      <dl className="divide-y divide-line border-y border-line">
        {rows.map(([label, value, note]) => (
          <div key={label} className="flex items-baseline gap-4 py-2">
            <dt className="flex-1"><span className="text-body">{label}</span> <span className="block text-aux text-muted-foreground">{note}</span></dt>
            <dd className="text-people font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
