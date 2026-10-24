"use client";

import type { ReactNode } from "react";
import { ContinuityLine, continuityState } from "@/components/relevo/continuity-line";
import { Status } from "@/components/ui/status";
import { Countdown } from "@/components/ui/countdown";
import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { RegistroContinuo } from "@/components/registro/registro";
import { ResultadosAviso } from "@/components/registro/resultados-aviso";
import { hhmm } from "@/components/registro/time";
import { usePublicState } from "@/lib/client/state";
import type { ActorDTO, IncidentSummaryDTO, PublicStateDTO } from "@/lib/contracts/client";
import { Conexion } from "./conexion";

const SERVICE: Record<string, string> = {
  facturacion: "Facturación", red_locales: "Red de locales", correo: "Correo", vpn: "VPN",
  impresora: "Impresora", cuentas: "Cuentas", otro: "Otro servicio",
};

const OUTGOING_FALLBACK: ActorDTO = { id: "actor_saliente" as ActorDTO["id"], displayName: "Turno saliente" };

function incidentText(i: IncidentSummaryDTO): ReactNode {
  const service = SERVICE[i.service] ?? i.service;
  if (i.status === "taken") return <Status kind="active">{service}: tomado por {i.takenBy?.displayName ?? "quien lo atiende"}</Status>;
  if (i.status === "unacknowledged") return <Status kind="uncovered">{service}: sin acuse</Status>;
  return (
    <Status kind="pending">
      {service}: esperando acuse de {i.candidate?.displayName ?? "un responsable"}
      {i.deadlineAt ? <> · <Countdown deadlineAt={i.deadlineAt} label={`Plazo de acuse hasta las ${hhmm(i.deadlineAt)}`} /></> : null}
    </Status>
  );
}

function Panel({ state, qr }: { state: PublicStateDTO; qr: ReactNode }) {
  const outgoing = state.events.find(e => e.kind === "handoff_sent")?.actor ?? OUTGOING_FALLBACK;
  const incoming = state.handoff?.candidate ?? state.coverage?.actor ?? null;
  return (
    <div className="grid gap-12 lg:grid-cols-[3fr_2fr]">
      <div className="flex flex-col gap-10">
        <section aria-labelledby="escena-titulo" className="flex flex-col gap-2">
          <h2 id="escena-titulo" className="text-section font-semibold">Escena: {state.scene.label}</h2>
          <p className="text-body">Hora de la escena: <strong>{hhmm(state.clocks.narrativeNow)}</strong></p>
          <p className="text-aux text-muted-foreground">Hora real del servidor: {hhmm(state.clocks.operationalNow)}. Los plazos corren en hora real.</p>
        </section>
        <section aria-labelledby="cadena-titulo" className="flex flex-col gap-2">
          <h2 id="cadena-titulo" className="text-section font-semibold">Cadena de responsabilidad</h2>
          {state.handoff || state.coverage ? (
            <ContinuityLine
              outgoing={outgoing} incoming={incoming} state={continuityState(state.handoff, state.coverage)}
              startsAtLabel={state.coverage ? hhmm(state.coverage.startsAt) : undefined}
            />
          ) : <EmptyState title="Aún no se envía el relevo" />}
        </section>
        <section aria-labelledby="incidentes-titulo" className="flex flex-col gap-2">
          <h2 id="incidentes-titulo" className="text-section font-semibold">Incidentes</h2>
          {state.incidents.length === 0 ? <EmptyState title="Sin incidentes registrados" /> : (
            <ul className="divide-y divide-line border-y border-line">
              {state.incidents.map(i => <li key={i.id} className="py-3">{incidentText(i)}</li>)}
            </ul>
          )}
        </section>
        <RegistroContinuo events={state.events} />
      </div>
      <div className="flex flex-col gap-10">
        {qr}
        <section aria-labelledby="rodrigo-titulo" className="flex flex-col gap-1">
          <h2 id="rodrigo-titulo" className="text-section font-semibold">Avisos a Rodrigo: {state.outgoingNoticeCount}</h2>
          <p className="text-aux text-muted-foreground">Intenciones de aviso registradas en esta ejecución. No confirman recepción ni despertares.</p>
        </section>
        <ResultadosAviso state={state} />
      </div>
    </div>
  );
}

/** Espejo público: solo lectura, sin controles privilegiados. El QR llega ya generado desde el servidor. */
export function ProyectorView({ qr }: { qr: ReactNode }) {
  const view = usePublicState(1000, { keepPaceHidden: true });
  return (
    <>
      <Conexion view={view} />
      {view.executionChanged ? <p className="text-aux text-muted-foreground">Se inició una nueva ejecución; se muestra solo su registro.</p> : null}
      {view.state ? <Panel state={view.state} qr={qr} /> : view.status === "loading" ? <LoadingState title="Cargando estado" /> : (
        <EmptyState title="Todavía no hay estado comprobado">No se muestra cobertura hasta recibir una lectura del servidor.</EmptyState>
      )}
    </>
  );
}
