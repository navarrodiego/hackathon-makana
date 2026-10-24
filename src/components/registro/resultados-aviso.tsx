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

/** Versión compacta para el pie del proyector: cifras en una línea y las salvedades en una sola frase. */
export function ResultadosAviso({ state }: { state: PublicStateDTO }) {
  const t = tallyNotices(state);
  const rows: [string, number][] = [
    ["Aceptados por ntfy", t.ntfyAccepted],
    ["In-app registrados", t.inAppRecorded],
    ["Fallidos", t.failed],
    ["Pendientes", t.pending],
    ["Incidentes tomados", t.taken],
    ["Acciones de escenario", t.scenarioEvents],
  ];
  return (
    <section aria-labelledby="avisos-titulo" className="flex flex-col gap-2">
      <h2 id="avisos-titulo" className="text-aux font-semibold text-muted-foreground">Resultados de aviso</h2>
      <dl className="flex flex-wrap gap-x-8 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-2">
            <dt className="text-aux text-muted-foreground">{label}</dt>
            <dd className="text-body font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-aux text-muted-foreground">
        Aceptado por ntfy no prueba que el teléfono lo recibió. In-app es una representación en pantalla, no un dispositivo. Tomado no significa resuelto.
      </p>
    </section>
  );
}
