"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ContinuityLine, continuityState } from "@/components/relevo/continuity-line";
import { Status } from "@/components/ui/status";
import { Countdown } from "@/components/ui/countdown";
import { DegradedNotice, EmptyState, LoadingState } from "@/components/ui/feedback";
import { hhmm } from "@/components/registro/time";
import { usePublicState } from "@/lib/client/state";
import type { ActorDTO, IncidentSummaryDTO, PublicStateDTO } from "@/lib/contracts/client";
import { cierre } from "./cierre";
import { Conexion } from "./conexion";
import { QrImage, type CanalQr } from "./qr-image";
import { relato } from "./relato";

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

function Cabecera({ state, live }: { state: PublicStateDTO; live: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-b border-line pb-6">
      <p className="text-section font-semibold">Relevo</p>
      <div className="flex items-center gap-8">
        {live}
        <p className="text-title font-semibold tabular-nums">
          <span className="sr-only">Hora de la historia: </span>{hhmm(state.clocks.narrativeNow)}
        </p>
      </div>
    </header>
  );
}

/** Relevo en borrador: el saliente sigue a cargo y cierra su turno. Solo conteos; sin pendientes ni nota. */
function Cierre({ state, emphasis }: { state: PublicStateDTO; emphasis?: boolean }) {
  if (!state.closing) return null;
  const c = cierre(state.closing, state.coverage?.outgoingEndsAt ?? null, state.clocks.narrativeNow);
  return (
    <div className="flex flex-col gap-3 py-2">
      <p className={emphasis ? "text-title font-semibold tracking-[-0.02em] text-balance" : "text-people font-semibold text-balance"}>{c.titulo}</p>
      <p className={emphasis ? "text-people text-balance" : "text-section text-balance"}>{c.pendientes}</p>
      <p className="text-body text-muted-foreground">{c.siguiente}</p>
    </div>
  );
}

/** Quién está a cargo: el cierre en curso, la cadena con nombres, o una frase cuando todavía no hay nadie a quien unir. */
function ACargo({ state, emphasis }: { state: PublicStateDTO; emphasis?: boolean }) {
  const outgoing = state.events.find(e => e.kind === "handoff_sent")?.actor
    ?? state.events.find(e => e.kind === "outgoing_ended")?.actor ?? null;
  const incoming = state.handoff?.candidate ?? state.coverage?.actor ?? null;
  const cs = continuityState(state.handoff, state.coverage);
  const deadline = cs === "awaiting" ? state.handoff?.deadlineAt ?? null : null;
  const saliente = outgoing?.displayName ?? "El turno saliente";
  return (
    <section aria-labelledby="cargo-titulo" className="flex flex-col gap-2">
      <h2 id="cargo-titulo" className={LABEL}>A cargo del turno</h2>
      {state.closing ? <Cierre state={state} emphasis={emphasis} /> : incoming ? (
        <>
          <ContinuityLine outgoing={outgoing ?? OUTGOING_FALLBACK} incoming={incoming} state={cs} emphasis={emphasis}
            startsAtLabel={state.coverage ? hhmm(state.coverage.startsAt) : undefined} />
          {deadline ? (
            <p className="text-body text-muted-foreground">
              Tiene <Countdown className="font-semibold text-foreground tabular-nums" deadlineAt={deadline} label={`Plazo de aceptación hasta las ${hhmm(deadline)}`} /> para aceptar.
            </p>
          ) : null}
        </>
      ) : state.handoff || state.coverage ? (
        <div className="flex flex-col gap-2 py-2">
          <Status kind="uncovered" className={emphasis ? "text-people" : "text-section"}>Sin cobertura confirmada</Status>
          <p className="text-body text-muted-foreground">{state.handoff ? "Nadie aceptó el relevo." : `${saliente} aún no envía el relevo.`}</p>
        </div>
      ) : (
        <EmptyState title={`${saliente} aún no envía el relevo`} />
      )}
    </section>
  );
}

function AvisosRodrigo({ count, emphasis }: { count: number; emphasis?: boolean }) {
  return (
    <section aria-labelledby="rodrigo-titulo" className="flex flex-col gap-1">
      <h2 id="rodrigo-titulo" className={emphasis ? "text-title font-semibold" : "text-people font-semibold"}>
        Avisos a <span className="whitespace-nowrap">Rodrigo: <span className="tabular-nums">{count}</span></span>
      </h2>
      <p className="text-body text-muted-foreground">Avisos que el sistema le dirigió en esta demostración.</p>
    </section>
  );
}

function Incidente({ i, state }: { i: IncidentSummaryDTO; state: PublicStateDTO }) {
  const service = SERVICE[i.service] ?? i.service;
  if (i.status === "taken") {
    const desdeControl = state.events.some(e => e.kind === "incident_taken" && e.origin === "scenario" && e.actor?.id === i.takenBy?.id);
    return (
      <div className="flex flex-col gap-1">
        <Status kind="active" className="text-people">{service}: tomado por {i.takenBy?.displayName ?? "quien lo atiende"}</Status>
        <p className="text-body text-muted-foreground">
          Lo está atendiendo. Tomado no significa resuelto.{desdeControl ? " Registrado por quien presenta." : ""}
        </p>
      </div>
    );
  }
  if (i.status === "unacknowledged") return <Status kind="uncovered" className="text-people">{service}: sin acuse</Status>;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
      <Status kind="pending" className="text-people">{service}: esperando acuse de {i.candidate?.displayName ?? "un responsable"}</Status>
      {i.deadlineAt ? (
        <Countdown className="text-title font-semibold tabular-nums" deadlineAt={i.deadlineAt} label={`Plazo de acuse hasta las ${hhmm(i.deadlineAt)}`} />
      ) : null}
    </div>
  );
}

/** Solo aparece con incidentes: «Ahora» es lo que está pasando, no una lista vacía. */
function Ahora({ state }: { state: PublicStateDTO }) {
  if (state.incidents.length === 0) return null;
  return (
    <section aria-labelledby="ahora-titulo" className="flex flex-col gap-2">
      <h2 id="ahora-titulo" className={LABEL}>Ahora</h2>
      <ul className="divide-y divide-line border-y border-line">
        {state.incidents.map(i => <li key={i.id} className="py-4"><Incidente i={i} state={state} /></li>)}
      </ul>
    </section>
  );
}

function LoQuePaso({ state }: { state: PublicStateDTO }) {
  const hechos = relato(state.events);
  if (hechos.length === 0) return null;
  return (
    <section aria-labelledby="paso-titulo" className="flex flex-col gap-2">
      <h2 id="paso-titulo" className={LABEL}>Lo que pasó</h2>
      <ol className="divide-y divide-line border-y border-line">
        {hechos.map(h => (
          <li key={h.id} className="flex gap-5 py-3">
            <time className="min-w-16 shrink-0 text-body text-muted-foreground tabular-nums">{h.hora}</time>
            <span className="min-w-0 break-words text-body">
              {h.texto}
              {h.desdeControl ? <span className="text-muted-foreground"> · registrado por quien presenta</span> : null}
            </span>
          </li>
        ))}
      </ol>
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
          {/* En proyectores de poca altura (720 px) el QR y los avisos caben; quién está a cargo vuelve con el panel. */}
          <div className="[@media(max-height:52rem)]:hidden"><ACargo state={state} /></div>
          <AvisosRodrigo count={state.outgoingNoticeCount} />
        </div>
      </div>
    </div>
  );
}

function Panel({ state }: { state: PublicStateDTO }) {
  return (
    <div className="grid flex-1 content-start gap-x-20 gap-y-14 lg:grid-cols-[3fr_2fr]">
      <div className="flex flex-col gap-14">
        <ACargo state={state} emphasis />
        <Ahora state={state} />
      </div>
      <div className="flex flex-col gap-14">
        <AvisosRodrigo count={state.outgoingNoticeCount} emphasis />
        <LoQuePaso state={state} />
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
      <QrImage qr={qr} className="size-32" />
      <div className="flex flex-col gap-1">
        <h2 id="qr-titulo" className="text-body font-semibold">Envía un reporte</h2>
        <p className="break-all text-aux text-muted-foreground">{qr.url}</p>
      </div>
    </section>
  );
}

/**
 * Espejo público para la sala: quién está a cargo, qué pasa ahora y los avisos a Rodrigo. Solo lectura, sin
 * controles privilegiados. El registro completo y los resultados por canal viven en /control. Sigue consultando
 * cada segundo: esas lecturas evalúan los plazos.
 */
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
      <Cabecera state={state} live={view.status === "live" ? <Conexion view={view} /> : null} />
      {view.status === "lost" ? <Conexion view={view} /> : null}
      {faseQr && qr ? <FaseQr state={state} qr={qr} /> : (
        <>
          <Panel state={state} />
          <footer className="border-t border-line pt-6"><QrPequeno qr={qr} /></footer>
        </>
      )}
    </div>
  );
}
