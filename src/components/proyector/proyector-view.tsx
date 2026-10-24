"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ContinuityLine, continuityState } from "@/components/relevo/continuity-line";
import { Status } from "@/components/ui/status";
import { Countdown } from "@/components/ui/countdown";
import { DegradedNotice, EmptyState, LoadingState } from "@/components/ui/feedback";
import { RegistroContinuo } from "@/components/registro/registro";
import { ResultadosAviso } from "@/components/registro/resultados-aviso";
import { hhmm } from "@/components/registro/time";
import { usePublicState } from "@/lib/client/state";
import type { ActorDTO, IncidentSummaryDTO, PublicStateDTO } from "@/lib/contracts/client";
import { Conexion } from "./conexion";
import { QrImage, type CanalQr } from "./qr-image";

const SERVICE: Record<string, string> = {
  facturacion: "Facturación", red_locales: "Red de locales", correo: "Correo", vpn: "VPN",
  impresora: "Impresora", cuentas: "Cuentas", otro: "Otro servicio",
};

const OUTGOING_FALLBACK: ActorDTO = { id: "actor_saliente" as ActorDTO["id"], displayName: "Turno saliente" };

/** Tiempo que el QR ocupa la pantalla al abrirse el canal, salvo que antes aparezca un incidente. */
export const QR_FASE_MS = 45_000;

const LABEL = "text-aux font-semibold text-muted-foreground";

/**
 * Fase QR: al abrirse el canal el QR ocupa la pantalla; cede al panel tras QR_FASE_MS o con el primer incidente.
 * Solo mira lo observado por esta pestaña: no adelanta ni decide plazos.
 */
function useQrFase(channelOpen: boolean, hasIncident: boolean): boolean {
  const [prevOpen, setPrevOpen] = useState(channelOpen);
  const [expired, setExpired] = useState(false);
  if (channelOpen !== prevOpen) {
    setPrevOpen(channelOpen);
    setExpired(false);
  }
  useEffect(() => {
    if (!channelOpen || expired) return;
    const id = setTimeout(() => setExpired(true), QR_FASE_MS);
    return () => clearTimeout(id);
  }, [channelOpen, expired]);
  return channelOpen && !expired && !hasIncident;
}

function Cabecera({ state }: { state: PublicStateDTO }) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-line pb-6">
      <p className="text-section font-semibold">
        Relevo <span className="font-normal text-muted-foreground">· Escena: {state.scene.label}</span>
      </p>
      <p className="text-title font-semibold tabular-nums">
        <span className="sr-only">Hora de la escena: </span>{hhmm(state.clocks.narrativeNow)}
      </p>
    </header>
  );
}

function Cadena({ state }: { state: PublicStateDTO }) {
  const outgoing = state.events.find(e => e.kind === "handoff_sent")?.actor ?? OUTGOING_FALLBACK;
  const incoming = state.handoff?.candidate ?? state.coverage?.actor ?? null;
  return (
    <section aria-labelledby="cadena-titulo" className="flex flex-col gap-2">
      <h2 id="cadena-titulo" className={LABEL}>Cadena de responsabilidad</h2>
      {state.handoff || state.coverage ? (
        <ContinuityLine
          outgoing={outgoing} incoming={incoming} state={continuityState(state.handoff, state.coverage)}
          startsAtLabel={state.coverage ? hhmm(state.coverage.startsAt) : undefined}
        />
      ) : <EmptyState title="Aún no se envía el relevo" />}
    </section>
  );
}

function AvisosRodrigo({ count }: { count: number }) {
  return (
    <section aria-labelledby="rodrigo-titulo" className="flex flex-col gap-1">
      <h2 id="rodrigo-titulo" className="text-people font-semibold">Avisos a Rodrigo: <span className="tabular-nums">{count}</span></h2>
      <p className="text-aux text-muted-foreground">Intenciones de aviso registradas en esta ejecución. No confirman recepción ni despertares.</p>
    </section>
  );
}

function Incidente({ i }: { i: IncidentSummaryDTO }): ReactNode {
  const service = SERVICE[i.service] ?? i.service;
  if (i.status === "taken") return <Status kind="active">{service}: tomado por {i.takenBy?.displayName ?? "quien lo atiende"}</Status>;
  if (i.status === "unacknowledged") return <Status kind="uncovered">{service}: sin acuse</Status>;
  return (
    <>
      <Status kind="pending">{service}: esperando acuse de {i.candidate?.displayName ?? "un responsable"}</Status>
      {i.deadlineAt ? (
        <Countdown className="text-title font-semibold tabular-nums" deadlineAt={i.deadlineAt} label={`Plazo de acuse hasta las ${hhmm(i.deadlineAt)}`} />
      ) : null}
    </>
  );
}

function Incidentes({ incidents }: { incidents: readonly IncidentSummaryDTO[] }) {
  return (
    <section aria-labelledby="incidentes-titulo" className="flex flex-col gap-2">
      <h2 id="incidentes-titulo" className={LABEL}>Incidentes</h2>
      {incidents.length === 0 ? <EmptyState title="Sin incidentes registrados" /> : (
        <ul className="divide-y divide-line border-y border-line">
          {incidents.map(i => (
            <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1 py-4 text-people"><Incidente i={i} /></li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FaseQr({ state, qr }: { state: PublicStateDTO; qr: CanalQr }) {
  return (
    <div className="grid flex-1 items-center gap-x-20 gap-y-10 lg:grid-cols-[auto_minmax(0,1fr)]">
      <QrImage qr={qr} className="size-[min(62svh,88vw)] lg:size-[min(62svh,42vw)]" />
      <div className="flex flex-col gap-12">
        <section aria-labelledby="qr-titulo" className="flex flex-col gap-4">
          <h2 id="qr-titulo" className="text-[clamp(3rem,min(5vw,9svh),6rem)] leading-none font-semibold tracking-[-0.02em] text-balance">Envía un reporte</h2>
          <p className="text-people">Escanea el código con la cámara de tu teléfono.</p>
          <p className="break-all text-body text-muted-foreground">{qr.url}</p>
        </section>
        <div className="flex flex-col gap-8 border-t border-line pt-8">
          {/* En proyectores de poca altura (720 px) el QR y los avisos caben; la cadena vuelve con el panel. */}
          <div className="[@media(max-height:52rem)]:hidden"><Cadena state={state} /></div>
          <AvisosRodrigo count={state.outgoingNoticeCount} />
        </div>
      </div>
    </div>
  );
}

function Panel({ state }: { state: PublicStateDTO }) {
  return (
    <div className="grid flex-1 content-start gap-x-20 gap-y-12 lg:grid-cols-[3fr_2fr]">
      <div className="flex flex-col gap-12">
        <Cadena state={state} />
        <Incidentes incidents={state.incidents} />
      </div>
      <div className="flex flex-col gap-12">
        <AvisosRodrigo count={state.outgoingNoticeCount} />
        <RegistroContinuo events={state.events} limit={8} />
      </div>
    </div>
  );
}

function QrPequeno({ qr }: { qr: CanalQr | null }) {
  if (!qr) {
    return <DegradedNotice title="QR no disponible"><p>Falta configurar la dirección pública de la aplicación. Nadie puede enviar reportes desde este QR.</p></DegradedNotice>;
  }
  return (
    <section aria-labelledby="qr-titulo" className="flex items-center gap-5">
      <QrImage qr={qr} className="size-36" />
      <div className="flex max-w-64 flex-col gap-1">
        <h2 id="qr-titulo" className="text-body font-semibold">Envía un reporte</h2>
        <p className="break-all text-aux text-muted-foreground">{qr.url}</p>
      </div>
    </section>
  );
}

/** Espejo público: solo lectura, sin controles privilegiados. El QR llega ya generado desde el servidor. */
export function ProyectorView({ qr }: { qr: CanalQr | null }) {
  const view = usePublicState(1000, { keepPaceHidden: true });
  const state = view.state;
  const faseQr = useQrFase(state?.channelOpen ?? false, (state?.incidents.length ?? 0) > 0) && qr !== null;

  if (!state) {
    return view.status === "loading" ? <LoadingState title="Cargando estado" /> : (
      <>
        <Conexion view={view} />
        <EmptyState title="Todavía no hay estado comprobado">No se muestra cobertura hasta recibir una lectura del servidor.</EmptyState>
      </>
    );
  }
  return (
    <div className="flex flex-1 flex-col gap-10">
      <Cabecera state={state} />
      {view.status === "lost" ? <Conexion view={view} /> : null}
      {faseQr && qr ? <FaseQr state={state} qr={qr} /> : <Panel state={state} />}
      <footer className="flex flex-wrap items-end justify-between gap-x-16 gap-y-8 border-t border-line pt-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {faseQr ? null : <ResultadosAviso state={state} />}
          <p className="text-aux text-muted-foreground">
            {view.status === "live" ? <><Conexion view={view} /> · </> : null}
            Hora real del servidor: {hhmm(state.clocks.operationalNow)}. Los plazos corren en hora real.
            {view.executionChanged ? " Se inició una nueva ejecución; se muestra solo su registro." : null}
          </p>
        </div>
        {faseQr ? null : <QrPequeno qr={qr} />}
      </footer>
    </div>
  );
}
