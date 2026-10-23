"use client";

import { useState } from "react";
import type { ExecutionId, PublicStateDTO } from "@/lib/contracts/client";
import { RegistroContinuo } from "@/components/registro/registro";
import { Button } from "@/components/ui/button";
import { DegradedNotice, EmptyState } from "@/components/ui/feedback";
import { usePublicState } from "@/lib/client/state";
import { morningEvents, summarize } from "./model";

type Mode = "all" | "morning";

function Facts({ state }: { state: PublicStateDTO }) {
  const s = summarize(state);
  if (s.empty) return <EmptyState title="Aún no hay hechos registrados en esta ejecución" />;
  const rows: [string, number, string][] = [
    ["Avisos a Rodrigo", s.outgoingNotices, "Intenciones de aviso registradas. No confirman recepción ni despertares."],
    ["Reportes recibidos", s.reportsAdmitted, "Mensajes admitidos en el canal."],
    ["Incidentes creados", s.incidentsCreated, "Registrados como incidente."],
    ["Incidentes tomados", s.incidentsTaken, "Alguien asumió atenderlos. Tomado no significa resuelto."],
    ["Coberturas iniciadas", s.coverageActivated, "Inicio de cobertura registrado, distinto de tomar un incidente."],
  ];
  return (
    <>
      <dl className="divide-y divide-line border-y border-line">
        {rows.map(([label, value, note]) => (
          <div key={label} className="flex items-baseline gap-4 py-2">
            <dt className="flex-1"><span className="text-body">{label}</span> <span className="block text-aux text-muted-foreground">{note}</span></dt>
            <dd className="text-people font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {s.taken.length > 0 ? (
        <ul aria-label="Incidentes con responsable" className="divide-y divide-line border-y border-line">
          {s.taken.map(t => <li key={t.id} className="py-2 text-body">{t.text}</li>)}
        </ul>
      ) : null}
    </>
  );
}

/** Resumen de mañana: filtro del registro continuo y hechos observados de la ejecución vigente. */
export function ResumenPanel({ executionId }: { executionId: ExecutionId }) {
  const view = usePublicState(2000);
  const [mode, setMode] = useState<Mode>("morning");
  const state = view.state;
  const current = state !== null && state.executionId === executionId;

  return (
    <section aria-labelledby="resumen-titulo" className="space-y-4 border-t border-line pt-6">
      <h2 id="resumen-titulo" className="text-section font-semibold">Resumen y registro</h2>
      {view.status === "lost" ? <DegradedNotice title="Sin conexión con el estado">Lo que ves puede estar desactualizado.</DegradedNotice> : null}
      {state && !current ? (
        <DegradedNotice title="Se inició una nueva ejecución">Recarga la página para ver su cierre y su registro.</DegradedNotice>
      ) : null}
      {current ? (
        <>
          <Facts state={state} />
          <div role="group" aria-label="Vista del registro" className="flex gap-2">
            <Button aria-pressed={mode === "morning"} className="aria-pressed:border-foreground aria-pressed:bg-muted" onClick={() => setMode("morning")}>Mañana</Button>
            <Button aria-pressed={mode === "all"} className="aria-pressed:border-foreground aria-pressed:bg-muted" onClick={() => setMode("all")}>Registro continuo</Button>
          </div>
          <RegistroContinuo events={mode === "morning" ? morningEvents(state.events) : state.events} limit={20} />
        </>
      ) : !state && view.status === "loading" ? <p className="text-body">Cargando el registro…</p> : null}
    </section>
  );
}
